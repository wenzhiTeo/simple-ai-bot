import config from "./src/config/index.js";
import { sequelize, Prompt, Message, Reminder, Bill, Setting, initializeDatabase } from "./database/index.js";
import { GeminiService } from "./src/services/gemini.js";
import { ReminderService } from "./src/services/reminder.js";
import { createConversationStore } from "./src/core/conversationStore.js";
import { createRouter } from "./src/core/router.js";
import { DiscordAdapter } from "./src/adapters/discord/index.js";
import { WhatsAppAdapter } from "./src/adapters/whatsapp/index.js";
import { createBillSkill } from "./src/skills/bills/index.js";
import { createStatusCollector } from "./src/services/status.js";
import { setupCronJobs } from "./src/scheduler.js";
import startServer from "./src/server.js";

const DEFAULT_PROMPT = "你是一个聊天机器人，友好、有帮助且富有创造力。";

process.on("unhandledRejection", (error) => {
    console.error("❌ Unhandled rejection:", error);
});

try {
    await initializeDatabase();
} catch (error) {
    console.error("❌ Database failed:", error);
    process.exit(1);
}

// Both are read on every message, so edits in the admin panel apply immediately
const getSystemPrompt = async () => (await Prompt.getActive())?.content ?? DEFAULT_PROMPT;
const getSettings = () => Setting.current();

const ai = new GeminiService({
    apiKey: config.GEMINI_API_KEY,
    model: config.MODEL_NAME,
    maxOutputTokens: config.MAX_OUTPUT_TOKENS,
    getSettings,
});
const store = createConversationStore(Message, { limit: config.HISTORY_LIMIT });

// Platform adapters, keyed by name. Filled in below.
const adapters = new Map();

const skills = [
    createBillSkill({
        ai,
        Bill,
        adapters,
        recipient: config.BILL_RECIPIENT,
        people: config.BILL_SPLIT,
        // Sending to a WhatsApp contact must only be triggered from your own WhatsApp
        platforms: ["whatsapp"],
    }),
];
const router = createRouter({ ai, store, getSystemPrompt, getSettings, skills });
// Shared by the /status web page and the Discord /status command
const getStatus = createStatusCollector({
    adapters,
    router,
    models: { Message, Reminder, Prompt, Setting },
    databasePath: config.DATABASE_PATH,
});
const services = {
    reminderService: new ReminderService({ Reminder, adapters }),
    conversationStore: store,
    getStatus,
};

if (config.DISCORD_TOKEN) {
    adapters.set("discord", new DiscordAdapter({ config, services }));
}
if (config.WHATSAPP_PHONE) {
    adapters.set("whatsapp", new WhatsAppAdapter({ config }));
}
if (adapters.size === 0) {
    console.warn("⚠️ No platform configured (set DISCORD_TOKEN and/or WHATSAPP_PHONE). Only the web server will run.");
}

startServer(sequelize, { Setting, getStatus });

for (const adapter of adapters.values()) {
    try {
        await adapter.start(router.handle);
    } catch (error) {
        console.error(`❌ Failed to start ${adapter.name} adapter:`, error);
        adapters.delete(adapter.name);
    }
}

setupCronJobs(services, { historyRetentionDays: config.HISTORY_RETENTION_DAYS });

// Optional startup announcement on Discord
const discord = adapters.get("discord");
if (discord && config.INIT_CHANNEL_ID) {
    try {
        const intro = await ai.generate({
            system: await getSystemPrompt(),
            text: "简单介绍一下你自己，用一段话",
        });
        await discord.send(config.INIT_CHANNEL_ID, `@everyone 🤖 AI assistant is now ONLINE!\n${intro}`);
    } catch (error) {
        console.error("❌ Failed to send introduction:", error.message);
    }
}
