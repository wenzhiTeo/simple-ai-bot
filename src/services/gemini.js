import { GoogleGenAI } from "@google/genai";

/**
 * Stateless wrapper around the Gemini API.
 * Conversation history is owned by the caller (see core/conversationStore.js),
 * so one instance can safely serve every platform and conversation.
 */
export class GeminiService {
    constructor({ apiKey, model, maxOutputTokens }) {
        // Fail fast: a chat user should get an error reply, not wait minutes on SDK retries
        this.client = new GoogleGenAI({
            apiKey,
            httpOptions: { timeout: 30_000, retryOptions: { attempts: 2 } },
        });
        this.model = model;
        this.maxOutputTokens = maxOutputTokens;
    }

    /**
     * @param {object} input
     * @param {string} [input.system] system prompt
     * @param {{role: "user"|"model", text: string}[]} [input.history] earlier turns, oldest first
     * @param {string} [input.text] the new user message
     * @param {{mimeType: string, data: Buffer}[]} [input.images]
     * @returns {Promise<string>}
     */
    async generate({ system, history = [], text, images = [] }) {
        const parts = [];
        if (text?.trim()) parts.push({ text });
        for (const image of images) {
            parts.push({
                inlineData: { mimeType: image.mimeType, data: image.data.toString("base64") },
            });
        }
        if (parts.length === 0) throw new Error("No content provided");

        const contents = [
            ...history.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] })),
            { role: "user", parts },
        ];

        const response = await this.client.models.generateContent({
            model: this.model,
            contents,
            config: {
                systemInstruction: system,
                temperature: 0.9,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: this.maxOutputTokens,
            },
        });

        return response.text ?? "";
    }
}
