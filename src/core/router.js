/**
 * Platform-independent message handling.
 *
 * Every adapter (Discord today, WhatsApp later) turns its native event into an
 * IncomingMessage and hands it to router.handle(). Nothing in here may touch a
 * platform SDK.
 *
 * @typedef {object} IncomingImage
 * @property {string} mimeType
 * @property {() => Promise<Buffer>} load  downloads the image (adapter knows how to authenticate)
 *
 * @typedef {object} IncomingMessage
 * @property {string} platform        adapter name, e.g. "discord"
 * @property {string} conversationId  channel / chat id on that platform
 * @property {string} userId
 * @property {string} [userName]
 * @property {boolean} [isGroup]      several people share this conversation
 * @property {string} [text]
 * @property {IncomingImage[]} [images]
 * @property {(text: string) => Promise<unknown>} reply
 * @property {() => Promise<unknown>} [typing]
 */

const ERROR_REPLIES = [
    "呜呜，现在有点呆萌，想不出来说什么了啦... 🥺",
    "抱歉，我的大脑暂时短路了一下 🤖💭",
    "哎呀，遇到了一点小问题，请稍后再试试吧~ 😅",
];

const IMAGE_FAILED_REPLY = "图片没能下载下来，可以再发一次吗？🥺";

export function createRouter({ ai, store, getSystemPrompt, logger = console }) {
    // One message at a time per conversation, so history stays in order.
    const queues = new Map();

    function enqueue(key, task) {
        const previous = queues.get(key) ?? Promise.resolve();
        const next = previous.then(task, task);
        queues.set(key, next);
        next.finally(() => {
            if (queues.get(key) === next) queues.delete(key);
        });
        return next;
    }

    async function process(message, key) {
        await message.typing?.().catch(() => {});

        const images = [];
        for (const image of message.images ?? []) {
            try {
                images.push({ mimeType: image.mimeType, data: await image.load() });
            } catch (error) {
                logger.error("❌ Image download failed:", error.message);
            }
        }

        const text = message.text?.trim() ?? "";
        if (!text && images.length === 0) {
            if (message.images?.length) await message.reply(IMAGE_FAILED_REPLY);
            return;
        }

        const userText = message.isGroup && text && message.userName
            ? `${message.userName}: ${text}`
            : text;

        const [system, history] = await Promise.all([
            getSystemPrompt(),
            store.history(key),
        ]);

        const answer = (await ai.generate({ system, history, text: userText, images })).trim();
        if (!answer) throw new Error("Model returned an empty response");

        // Images are not kept in history, only a marker that one was sent.
        const historyText = [userText, images.length ? "[图片]" : ""].filter(Boolean).join(" ");
        await store.append(key, historyText, answer);
        await message.reply(answer);
    }

    return {
        /** @param {IncomingMessage} message */
        handle(message) {
            const key = `${message.platform}:${message.conversationId}`;
            return enqueue(key, async () => {
                try {
                    await process(message, key);
                } catch (error) {
                    logger.error("❌ Message handling failed:", error);
                    const fallback = ERROR_REPLIES[Math.floor(Math.random() * ERROR_REPLIES.length)];
                    await message.reply(fallback).catch(() => {});
                }
            });
        },
    };
}
