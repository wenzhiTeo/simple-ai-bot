import { GoogleGenAI } from "@google/genai";

/**
 * Stateless wrapper around the Gemini API.
 * Conversation history is owned by the caller (see core/conversationStore.js),
 * so one instance can safely serve every platform and conversation.
 */
export class GeminiService {
    /**
     * @param {object} options
     * @param {string} options.apiKey
     * @param {string} options.model            used when getSettings gives no model
     * @param {number} options.maxOutputTokens  used when getSettings gives no limit
     * @param {() => Promise<{model?: string, temperature?: number, maxOutputTokens?: number} | null>} [options.getSettings]
     *        read before every request, so settings edited in the admin panel apply immediately
     */
    constructor({ apiKey, model, maxOutputTokens, getSettings = async () => null }) {
        // Fail fast: a chat user should get an error reply, not wait minutes on SDK retries
        this.client = new GoogleGenAI({
            apiKey,
            httpOptions: { timeout: 30_000, retryOptions: { attempts: 2 } },
        });
        this.model = model;
        this.maxOutputTokens = maxOutputTokens;
        this.getSettings = getSettings;
    }

    async settings() {
        const current = (await this.getSettings()) ?? {};
        return {
            model: current.model || this.model,
            temperature: current.temperature ?? 0.9,
            maxOutputTokens: current.maxOutputTokens || this.maxOutputTokens,
        };
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
        const contents = [
            ...history.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] })),
            { role: "user", parts: toParts(text, images) },
        ];

        const { model, temperature, maxOutputTokens } = await this.settings();
        const response = await this.client.models.generateContent({
            model,
            contents,
            config: {
                systemInstruction: system,
                temperature,
                topK: 40,
                topP: 0.95,
                maxOutputTokens,
            },
        });

        return response.text ?? "";
    }

    /**
     * Structured extraction: the model must answer with JSON matching `schema`.
     * Used for reading numbers off images, so temperature is 0.
     * @returns {Promise<any>} the parsed JSON
     */
    async extractJson({ system, text, images = [], schema }) {
        const { model } = await this.settings();
        const response = await this.client.models.generateContent({
            model,
            contents: [{ role: "user", parts: toParts(text, images) }],
            config: {
                systemInstruction: system,
                temperature: 0,
                responseMimeType: "application/json",
                responseJsonSchema: schema,
            },
        });
        return JSON.parse(response.text ?? "null");
    }
}

/** Text + images (or PDFs) -> Gemini parts. `images` are { mimeType, data: Buffer }. */
function toParts(text, images) {
    const parts = [];
    if (text?.trim()) parts.push({ text });
    for (const image of images) {
        parts.push({ inlineData: { mimeType: image.mimeType, data: image.data.toString("base64") } });
    }
    if (parts.length === 0) throw new Error("No content provided");
    return parts;
}
