import cron from "node-cron";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Delete stored chat history older than `retentionDays`. Does nothing when it is 0. */
export async function pruneHistory(conversationStore, retentionDays, now = new Date()) {
    if (!retentionDays) return 0;
    const removed = await conversationStore.prune(new Date(now - retentionDays * DAY_MS));
    if (removed) console.log(`🧹 Removed ${removed} chat messages older than ${retentionDays} days`);
    return removed;
}

/** Register all recurring jobs here. */
export function setupCronJobs({ reminderService, conversationStore }, { historyRetentionDays }) {
    const logFailure = (job) => (error) => console.error(`❌ ${job} failed:`, error);

    // Deliver due reminders (every minute)
    cron.schedule("* * * * *", () => {
        reminderService.checkDue().catch(logFailure("Reminder check"));
    });

    // Clean up old chat history (once at startup, then daily at 03:00)
    const prune = () => pruneHistory(conversationStore, historyRetentionDays).catch(logFailure("History cleanup"));
    prune();
    cron.schedule("0 3 * * *", prune);

    console.log("✅ Cron jobs scheduled");
}
