import {
    currentPeriod,
    displayName,
    formatBill,
    mergeItems,
    parseBillCommand,
    parseItems,
    removeItem,
} from "./calc.js";

/** A draft that is not confirmed within this time is forgotten. */
const DRAFT_TTL_MS = 6 * 60 * 60 * 1000;

const CONFIRM_WORDS = ["确认", "确定", "发送", "ok"];
const CANCEL_WORDS = ["取消", "算了"];
const REMOVE_PATTERN = /^(?:删除?|去掉)\s*(.+)$/;

const USAGE = [
    "用法：",
    "水电费 9月 wifi 100 水 6.50 电 25.6",
    "也可以发账单照片或 PDF，配文写「水电费」。",
].join("\n");

const EXTRACT_PROMPT = `You read household utility bills from Malaysia (amounts in RM).
For every bill in the attachments, return one item:
- category: "wifi" for internet/broadband (Unifi, Maxis, TIME, Celcom, Digi…),
  "water" for water (Air Selangor, SAJ, …), "electricity" for electricity (TNB, …), otherwise "other"
- name: the provider or bill type as printed
- amount: the total amount payable for this bill, as a number in RM
Also return the billing month (year, month) if it is printed, otherwise null.
If an attachment is not a bill, skip it. Never guess an amount you cannot read.`;

const EXTRACT_SCHEMA = {
    type: "object",
    properties: {
        items: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    category: { type: "string", enum: ["wifi", "water", "electricity", "other"] },
                    name: { type: "string" },
                    amount: { type: "number" },
                },
                required: ["category", "name", "amount"],
            },
        },
        year: { type: ["integer", "null"] },
        month: { type: ["integer", "null"] },
    },
    required: ["items"],
};

/**
 * Utility-bill splitter.
 *
 * "水电费 …" (text and/or bill photos) builds a draft and replies with a preview.
 * While a draft is open: more photos or "电 25.6" update it, "删 电" removes a line,
 * "确认" sends it to the recipient, "取消" drops it. Any other message falls through
 * to normal chat and the draft stays open.
 *
 * @param {object} deps
 * @param {{ extractJson: Function }} deps.ai
 * @param {import("sequelize").ModelStatic<any>} deps.Bill
 * @param {Map<string, { send: Function }>} deps.adapters
 * @param {string} [deps.recipient] where confirmed bills go (platform-specific id)
 * @param {number} deps.people how many people share the bills
 * @param {string[]} deps.platforms only messages from these platforms may use this skill
 */
export function createBillSkill({ ai, Bill, adapters, recipient, people, platforms, now = () => new Date(), logger = console }) {
    const drafts = new Map();

    function getDraft(key) {
        const draft = drafts.get(key);
        if (draft && now() - draft.updatedAt > DRAFT_TTL_MS) {
            drafts.delete(key);
            return null;
        }
        return draft ?? null;
    }

    function saveDraft(key, draft) {
        draft.updatedAt = now();
        drafts.set(key, draft);
    }

    function preview(draft) {
        const { text } = formatBill({ ...draft, people });
        const sendLine = recipient
            ? `回复「确认」发送给 ${recipient}，「取消」放弃。`
            : "⚠️ 还没有设置收件人（BILL_RECIPIENT），暂时不能发送。";
        return [
            "📝 草稿，还没有发送：",
            "",
            text,
            "",
            sendLine,
            "修改发「电 25.60」，删除发「删 电」，也可以继续发账单照片。",
        ].join("\n");
    }

    /** Read bill photos / PDFs with the model. Returns { items, period } (period may be null). */
    async function readAttachments(images) {
        const files = [];
        for (const image of images) files.push({ mimeType: image.mimeType, data: await image.load() });

        const result = await ai.extractJson({ system: EXTRACT_PROMPT, images: files, schema: EXTRACT_SCHEMA });
        const items = (result?.items ?? [])
            .filter((item) => Number.isFinite(item.amount) && item.amount > 0)
            .map((item) => ({ name: displayName(item.name, item.category), cents: Math.round(item.amount * 100) }));
        const period = result?.month >= 1 && result?.month <= 12 && result?.year > 2000
            ? { year: result.year, month: result.month }
            : null;
        return { items, period };
    }

    /** Merge attachments into the draft. Returns a note for the user when nothing could be read. */
    async function addAttachments(draft, images, { usePeriod }) {
        try {
            const { items, period } = await readAttachments(images);
            draft.items = mergeItems(draft.items, items);
            if (usePeriod && period) draft.period = period;
            return items.length ? "" : "⚠️ 图片里没有读到账单金额。";
        } catch (error) {
            logger.error("❌ Bill image reading failed:", error);
            return "⚠️ 图片识别失败，可以重发一次，或者直接打字输入金额。";
        }
    }

    async function confirm(message, key, draft) {
        if (!recipient) {
            await message.reply("⚠️ 还没有设置收件人（BILL_RECIPIENT），不能发送。");
            return;
        }
        if (draft.items.length === 0) {
            await message.reply("草稿里还没有任何项目。");
            return;
        }

        const { text, totalCents } = formatBill({ ...draft, people });
        await adapters.get(message.platform).send(recipient, text);
        drafts.delete(key);

        await Bill.create({
            platform: message.platform,
            year: draft.period.year,
            month: draft.period.month,
            items: draft.items,
            people,
            totalCents,
            recipient,
            text,
        });
        await message.reply(`✅ 已发送给 ${recipient}`);
    }

    return {
        name: "bills",

        /** @returns {Promise<boolean>} true when the message was handled here */
        async handle(message, { key }) {
            if (!platforms.includes(message.platform)) return false;

            const text = message.text?.trim() ?? "";
            const images = message.images ?? [];

            // New bill
            const command = parseBillCommand(text, now());
            if (command) {
                const draft = { period: command.period ?? currentPeriod(now()), items: command.items };
                const notes = [];
                if (command.leftover) notes.push(`⚠️ 这部分没看懂，已忽略：${command.leftover}`);
                if (images.length) {
                    const note = await addAttachments(draft, images, { usePeriod: !command.period });
                    if (note) notes.push(note);
                }

                if (draft.items.length === 0) {
                    await message.reply([...notes, USAGE].join("\n\n"));
                    return true;
                }
                saveDraft(key, draft);
                await message.reply([...notes, preview(draft)].join("\n\n"));
                return true;
            }

            // Follow-ups only apply while a draft is open
            const draft = getDraft(key);
            if (!draft) return false;

            const lower = text.toLowerCase();
            if (CONFIRM_WORDS.includes(lower)) {
                await confirm(message, key, draft);
                return true;
            }
            if (CANCEL_WORDS.includes(lower)) {
                drafts.delete(key);
                await message.reply("🗑️ 已取消这份水电费草稿。");
                return true;
            }

            const removal = text.match(REMOVE_PATTERN);
            if (removal) {
                draft.items = removeItem(draft.items, removal[1]);
                saveDraft(key, draft);
                await message.reply(preview(draft));
                return true;
            }

            const parsed = parseItems(text);
            if (images.length || parsed.complete) {
                const notes = [];
                if (parsed.complete) draft.items = mergeItems(draft.items, parsed.items);
                if (images.length) {
                    const note = await addAttachments(draft, images, { usePeriod: false });
                    if (note) notes.push(note);
                }
                saveDraft(key, draft);
                await message.reply([...notes, preview(draft)].join("\n\n"));
                return true;
            }

            return false;
        },
    };
}
