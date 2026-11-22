import dotenv from "dotenv";
dotenv.config();

const int = (value, fallback) => parseInt(value, 10) || fallback;
const list = (value) => value?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];

const config = {
    // Gemini
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    MODEL_NAME: process.env.MODEL_NAME || "gemini-2.5-flash",
    MAX_OUTPUT_TOKENS: int(process.env.MAX_OUTPUT_TOKENS, 4096),
    // How many past messages of a conversation are sent to the model
    HISTORY_LIMIT: int(process.env.HISTORY_LIMIT, 20),
    // Stored messages older than this are deleted once a day (0 = keep forever)
    HISTORY_RETENTION_DAYS: process.env.HISTORY_RETENTION_DAYS === "0"
        ? 0
        : int(process.env.HISTORY_RETENTION_DAYS, 30),

    // Discord (the adapter is enabled when DISCORD_TOKEN is set)
    DISCORD_TOKEN: process.env.DISCORD_TOKEN,
    INIT_CHANNEL_ID: process.env.INIT_CHANNEL_ID,
    BLACKLISTED_CHANNEL_IDS: list(process.env.BLACKLISTED_CHANNEL_IDS),
    IS_MENTION_ONLY: process.env.IS_MENTION_ONLY !== "false",
    MAX_MESSAGE_LENGTH: int(process.env.MAX_MESSAGE_LENGTH, 2000),

    // Web server / admin panel
    ADMIN_PORT: int(process.env.ADMIN_PORT, 3000),
    // When ADMIN_PASSWORD is set, /admin asks for it (HTTP Basic auth).
    // When it is not set, /admin only answers requests from this machine.
    ADMIN_USER: process.env.ADMIN_USER || "admin",
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,

    // Storage
    DATABASE_PATH: process.env.DATABASE_PATH || "database.sqlite",

    // Image processing
    IMAGE_DOWNLOAD_TIMEOUT: int(process.env.IMAGE_DOWNLOAD_TIMEOUT, 15000),
    IMAGE_DOWNLOAD_RETRIES: int(process.env.IMAGE_DOWNLOAD_RETRIES, 3),

    ENABLE_DEBUG_LOGS: process.env.ENABLE_DEBUG_LOGS === "true",
};

if (!config.GEMINI_API_KEY) {
    console.error("❌ Missing required environment variable: GEMINI_API_KEY");
    process.exit(1);
}

export default config;
