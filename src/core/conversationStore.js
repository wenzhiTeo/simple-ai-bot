import { Op } from "sequelize";

/**
 * Persists chat history per conversation.
 * A conversation key is "<platform>:<conversationId>", e.g. "discord:1234567890".
 */
export function createConversationStore(Message, { limit = 20 } = {}) {
    return {
        /**
         * Most recent turns, oldest first, always starting with a user turn.
         * @param {string} conversationKey
         * @param {number} [max] overrides the store's default limit; 0 = no history
         */
        async history(conversationKey, max = limit) {
            if (max <= 0) return [];
            const rows = await Message.findAll({
                where: { conversationKey },
                order: [["id", "DESC"]],
                limit: max,
            });
            rows.reverse();
            while (rows.length && rows[0].role !== "user") rows.shift();
            return rows.map((row) => ({ role: row.role, text: row.text }));
        },

        /** Save one completed exchange. Only called after the model answered. */
        async append(conversationKey, userText, modelText) {
            await Message.bulkCreate([
                { conversationKey, role: "user", text: userText },
                { conversationKey, role: "model", text: modelText },
            ]);
        },

        /** Forget one conversation. @returns {Promise<number>} rows removed */
        async clear(conversationKey) {
            return Message.destroy({ where: { conversationKey } });
        },

        /** Delete everything older than `cutoff`, in all conversations. @returns {Promise<number>} rows removed */
        async prune(cutoff) {
            return Message.destroy({ where: { createdAt: { [Op.lt]: cutoff } } });
        },
    };
}
