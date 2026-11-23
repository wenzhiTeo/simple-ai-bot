// Status snapshots for tests and previews, shaped like createStatusCollector()() without `health`.
const MB = 1024 * 1024;
const GB = 1024 * MB;
const NOW = Date.parse("2026-11-22T08:00:00Z");
const minutesAgo = (m) => new Date(NOW - m * 60_000).toISOString();

export { NOW };

/** Like the Oracle free VM: Linux, 1 GB, no swap; WhatsApp down and a recent failed reply. */
export function oracleTrouble() {
    return {
        time: new Date(NOW).toISOString(),
        bot: {
            platforms: [{ name: "discord", connected: true }, { name: "whatsapp", connected: false }],
            settings: { model: "gemini-2.5-pro", temperature: 1.3, maxOutputTokens: 2048, historyLimit: 10 },
            prompt: "小云雀来海 个性",
            handled: 128,
            failed: 3,
            lastError: { at: minutesAgo(42), message: "404 models/gemini-2.5-pr is not found for API version v1beta" },
        },
        process: { uptimeSec: 3 * 86400 + 5 * 3600, rssBytes: 231 * MB, heapUsedBytes: 98 * MB, node: "v20.19.6", pid: 4242 },
        system: {
            platform: "Linux 5.15.0-1081-oracle (x64)",
            uptimeSec: 201 * 86400,
            cpus: 2,
            loadavg: [0.02, 0.05, 0.01],
            memory: { totalBytes: 952 * MB, availableBytes: 160 * MB, swapTotalBytes: 0, swapFreeBytes: 0 },
            disk: { totalBytes: 45 * GB, freeBytes: 40 * GB },
        },
        data: { messages: 1534, conversations: 6, lastMessageAt: minutesAgo(5), reminders: 2, databaseBytes: 3.4 * MB },
    };
}

/** Everything fine: connected, 2 GB swap barely used, plenty of memory and disk. */
export function healthy() {
    const status = oracleTrouble();
    status.bot.platforms = [{ name: "discord", connected: true }];
    status.bot.failed = 0;
    status.bot.lastError = null;
    status.system.memory = { totalBytes: 952 * MB, availableBytes: 520 * MB, swapTotalBytes: 2 * GB, swapFreeBytes: 2 * GB - 20 * MB };
    return status;
}
