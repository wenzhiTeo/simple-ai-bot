import os from "node:os";
import path from "node:path";
import { readFile, stat, statfs } from "node:fs/promises";
import { ago, bytes, platformName } from "../utils/format.js";

/**
 * Collects everything the /status page shows: the bot (platforms, model, errors),
 * this process, the machine (memory, swap, disk, load) and the stored data.
 * Every section is gathered separately, so one failing (e.g. the database) still
 * leaves the rest of the page readable.
 *
 * @param {object} deps
 * @param {Map<string, {connected?: boolean}>} deps.adapters
 * @param {{ stats: () => object }} deps.router
 * @param {{ Message, Reminder, Prompt, Setting }} deps.models
 * @param {string} deps.databasePath
 */
export function createStatusCollector({ adapters, router, models, databasePath }) {
    const { Message, Reminder, Prompt, Setting } = models;

    async function bot() {
        const [settings, prompt] = await Promise.all([Setting.current(), Prompt.getActive()]);
        return {
            platforms: [...adapters.entries()].map(([name, adapter]) => ({ name, connected: Boolean(adapter.connected) })),
            settings,
            prompt: prompt?.title ?? null,
            ...router.stats(),
        };
    }

    async function data() {
        const [messages, conversations, lastMessageAt, reminders, databaseBytes] = await Promise.all([
            Message.count(),
            Message.count({ distinct: true, col: "conversationKey" }),
            Message.max("createdAt"),
            Reminder.count(),
            stat(databasePath).then((file) => file.size, () => null),
        ]);
        return { messages, conversations, lastMessageAt: lastMessageAt ?? null, reminders, databaseBytes };
    }

    async function system() {
        return {
            platform: `${os.type()} ${os.release()} (${os.arch()})`,
            uptimeSec: os.uptime(),
            cpus: os.cpus().length,
            loadavg: os.loadavg(),
            memory: await systemMemory(),
            disk: await diskUsage(path.dirname(path.resolve(databasePath))),
        };
    }

    function processInfo() {
        const memory = process.memoryUsage();
        return {
            uptimeSec: process.uptime(),
            rssBytes: memory.rss,
            heapUsedBytes: memory.heapUsed,
            node: process.version,
            pid: process.pid,
        };
    }

    return async function collect() {
        const [botResult, dataResult, systemResult] = await Promise.all([settle(bot), settle(data), settle(system)]);
        const status = {
            time: new Date().toISOString(),
            bot: botResult,
            process: processInfo(),
            system: systemResult,
            data: dataResult,
        };
        return { ...status, health: assess(status) };
    };
}

// [warning, critical] thresholds. memory/swap/disk: percent used. load: 5-minute load per CPU.
const LIMITS = { memory: [80, 90], swap: [50, 80], disk: [85, 95], load: [0.8, 1.5] };
// ecosystem.config.cjs max_memory_restart
const PM2_RESTART_BYTES = 600 * 1024 * 1024;
const DAY_MS = 24 * 60 * 60 * 1000;
const RANK = { good: 0, warning: 1, critical: 2 };

function level(value, [warnAt, criticalAt]) {
    if (value >= criticalAt) return "critical";
    if (value >= warnAt) return "warning";
    return "good";
}
const percentUsed = (used, total) => (total ? (used / total) * 100 : 0);

/**
 * Judges a collected status. Shared by the /status page and the Discord /status command,
 * so both flag the same things.
 * @returns {{
 *   overall: "good"|"warning"|"critical",
 *   problems: {level: "warning"|"critical", text: string}[],  worst first
 *   levels: {memory, swap, disk, load}  each "good"|"warning"|"critical", or null when unknown
 * }}
 */
export function assess({ bot, process: proc, system, data }, now = Date.now()) {
    const problems = [];
    const add = (lvl, text) => problems.push({ level: lvl, text });
    const levels = { memory: null, swap: null, disk: null, load: null };

    if (bot.error) add("critical", "机器人信息读取失败");
    else {
        for (const p of bot.platforms) if (!p.connected) add("critical", `${platformName(p.name)} 未连接`);
        if (bot.platforms.length === 0) add("warning", "没有配置任何聊天平台");
        if (bot.lastError && now - Date.parse(bot.lastError.at) < DAY_MS) {
            add("warning", `最近 24 小时内有回复失败（${ago(bot.lastError.at, now)}）`);
        }
    }

    if (data.error) add("critical", "数据库读取失败");

    if (system.error) add("warning", "服务器信息读取失败");
    else {
        const m = system.memory;
        // Only Linux gives a real "available" figure (swap is null elsewhere): don't alarm on a dev Mac
        levels.memory = m.swapTotalBytes === null
            ? "good"
            : level(percentUsed(m.totalBytes - m.availableBytes, m.totalBytes), LIMITS.memory);
        if (levels.memory !== "good") add(levels.memory, `内存可用只剩 ${bytes(m.availableBytes)}`);

        if (m.swapTotalBytes === 0) {
            levels.swap = "warning";
            add("warning", "没有开启 swap，内存紧张时容易被系统杀掉进程");
        } else if (m.swapTotalBytes) {
            const used = m.swapTotalBytes - m.swapFreeBytes;
            levels.swap = level(percentUsed(used, m.swapTotalBytes), LIMITS.swap);
            if (levels.swap !== "good") add(levels.swap, `swap 已用 ${bytes(used)}，内存吃紧`);
        }

        if (system.disk) {
            const { totalBytes, freeBytes } = system.disk;
            levels.disk = level(percentUsed(totalBytes - freeBytes, totalBytes), LIMITS.disk);
            if (levels.disk !== "good") add(levels.disk, `磁盘只剩 ${bytes(freeBytes)}`);
        }

        levels.load = level(system.loadavg[1] / system.cpus, LIMITS.load);
        if (levels.load !== "good") add(levels.load, `负载偏高（5 分钟平均 ${system.loadavg[1].toFixed(2)}，${system.cpus} 个 CPU）`);
    }

    if (proc.rssBytes > PM2_RESTART_BYTES * 0.75) {
        add("warning", `机器人进程占用 ${bytes(proc.rssBytes)}，接近 pm2 自动重启线 600 MB`);
    }

    problems.sort((a, b) => RANK[b.level] - RANK[a.level]);
    return { overall: problems[0]?.level ?? "good", problems, levels };
}

/** Runs `fn`; a failure becomes `{ error }` instead of failing the whole page. */
async function settle(fn) {
    try {
        return await fn();
    } catch (error) {
        return { error: String(error?.message ?? error) };
    }
}

/**
 * /proc/meminfo -> bytes. `available` is MemAvailable: what programs can still get
 * (free memory plus reclaimable cache), the number that matters on a small server.
 */
export function parseMeminfo(text) {
    const read = (key) => {
        const match = text.match(new RegExp(`^${key}:\\s+(\\d+) kB`, "m"));
        return match ? Number(match[1]) * 1024 : null;
    };
    return {
        totalBytes: read("MemTotal"),
        availableBytes: read("MemAvailable"),
        swapTotalBytes: read("SwapTotal"),
        swapFreeBytes: read("SwapFree"),
    };
}

async function systemMemory() {
    try {
        const info = parseMeminfo(await readFile("/proc/meminfo", "utf8"));
        if (info.totalBytes && info.availableBytes !== null) return info;
    } catch {
        // not Linux
    }
    // Elsewhere (e.g. macOS while developing) this undercounts what is really available
    return { totalBytes: os.totalmem(), availableBytes: os.freemem(), swapTotalBytes: null, swapFreeBytes: null };
}

/** Disk holding `dir`, in bytes. `freeBytes` is what a normal user can still write. */
async function diskUsage(dir) {
    try {
        const fs = await statfs(dir);
        return { totalBytes: fs.blocks * fs.bsize, freeBytes: fs.bavail * fs.bsize };
    } catch {
        return null;
    }
}
