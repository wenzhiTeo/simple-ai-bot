import { Op } from "sequelize";

/** Reminders that could not be delivered are dropped once they are this overdue. */
const GIVE_UP_AFTER_MS = 60 * 60 * 1000;

/** Parse "930" / "1430" (HHMM) into { hours, minutes }, or null if invalid. */
export function parseClockTime(input) {
    if (!/^\d{3,4}$/.test(input ?? "")) return null;
    const hours = parseInt(input.slice(0, -2), 10);
    const minutes = parseInt(input.slice(-2), 10);
    if (hours > 23 || minutes > 59) return null;
    return { hours, minutes };
}

/** The next time the clock shows hours:minutes (today, or tomorrow if already past). */
export function nextOccurrence({ hours, minutes }, now = new Date()) {
    const due = new Date(now);
    due.setHours(hours, minutes, 0, 0);
    if (due <= now) due.setDate(due.getDate() + 1);
    return due;
}

/**
 * Platform-independent reminders, stored in the database so they survive restarts.
 * Delivery goes through whichever adapter the reminder was created on.
 */
export class ReminderService {
    /**
     * @param {object} deps
     * @param {import("sequelize").ModelStatic<any>} deps.Reminder
     * @param {Map<string, {send: Function, mention?: Function}>} deps.adapters
     */
    constructor({ Reminder, adapters, logger = console }) {
        this.Reminder = Reminder;
        this.adapters = adapters;
        this.logger = logger;
    }

    create({ platform, conversationId, userId, text, dueAt }) {
        return this.Reminder.create({ platform, conversationId, userId, text, dueAt });
    }

    list(platform, userId) {
        return this.Reminder.findAll({ where: { platform, userId }, order: [["dueAt", "ASC"]] });
    }

    /** @returns {Promise<number>} how many were removed */
    clear(platform, userId) {
        return this.Reminder.destroy({ where: { platform, userId } });
    }

    /** Send every reminder that is due. Called once a minute by the scheduler. */
    async checkDue(now = new Date()) {
        const due = await this.Reminder.findAll({ where: { dueAt: { [Op.lte]: now } } });

        for (const reminder of due) {
            const adapter = this.adapters.get(reminder.platform);
            try {
                if (!adapter) throw new Error(`No adapter for platform "${reminder.platform}"`);
                const who = adapter.mention?.(reminder.userId) ?? "";
                await adapter.send(reminder.conversationId, `${who} ⏰ 提醒：${reminder.text}`.trim());
                await reminder.destroy();
            } catch (error) {
                this.logger.error(`❌ Reminder ${reminder.id} failed:`, error.message);
                // Keep it for the next tick unless it has been failing for too long.
                if (now - reminder.dueAt > GIVE_UP_AFTER_MS) await reminder.destroy();
            }
        }
    }
}
