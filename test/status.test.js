import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import express from "express";
import { createStatusCollector, parseMeminfo } from "../src/services/status.js";
import { createRouter, errorSummary } from "../src/core/router.js";
import { createConversationStore } from "../src/core/conversationStore.js";
import { createTestDb, silentLogger } from "./helpers.js";

process.env.GEMINI_API_KEY ||= "test-key";
const { statusRoutes } = await import("../src/server.js");

test("parseMeminfo reads total, available and swap in bytes", () => {
    const info = parseMeminfo([
        "MemTotal:         975200 kB",
        "MemFree:           83000 kB",
        "MemAvailable:     564000 kB",
        "SwapTotal:             0 kB",
        "SwapFree:              0 kB",
    ].join("\n"));
    assert.deepEqual(info, {
        totalBytes: 975200 * 1024,
        availableBytes: 564000 * 1024,
        swapTotalBytes: 0,
        swapFreeBytes: 0,
    });
    assert.equal(parseMeminfo("nothing here").totalBytes, null);
});

test("errorSummary pulls the readable part out of Gemini API errors", () => {
    const body = JSON.stringify({ error: { code: 404, message: "models/gemini-nope is not found", status: "NOT_FOUND" } });
    assert.equal(errorSummary(new Error(body)), "404 models/gemini-nope is not found");
    assert.equal(errorSummary(new Error(`got status: 404 Not Found. ${body}`)), "404 models/gemini-nope is not found");
    assert.equal(errorSummary(new Error("socket hang up")), "socket hang up");
    assert.equal(errorSummary(new Error("x".repeat(500))).length, 300);
});

test("router counts handled and failed messages and keeps the last error", async () => {
    const { Message } = await createTestDb();
    let fail = false;
    const ai = { async generate() { if (fail) throw new Error("quota exceeded"); return "ok"; } };
    const router = createRouter({ ai, store: createConversationStore(Message), getSystemPrompt: async () => "", logger: silentLogger });
    const msg = (text) => ({ platform: "discord", conversationId: "c", userId: "u", text, reply: async () => {} });

    await router.handle(msg("a"));
    fail = true;
    await router.handle(msg("b"));

    const stats = router.stats();
    assert.equal(stats.handled, 1);
    assert.equal(stats.failed, 1);
    assert.equal(stats.lastError.message, "quota exceeded");
    assert.ok(Date.parse(stats.lastError.at));
});

async function collectorSetup() {
    const db = await createTestDb();
    const dir = await mkdtemp(path.join(tmpdir(), "status-"));
    const databasePath = path.join(dir, "db.sqlite");
    await writeFile(databasePath, Buffer.alloc(2048));
    await db.Setting.seedDefaults({ model: "gemini-test", maxOutputTokens: 100, historyLimit: 10 });
    await db.Prompt.create({ title: "Cat", content: "meow", is_active: true });
    await db.Message.bulkCreate([
        { conversationKey: "discord:a", role: "user", text: "1" },
        { conversationKey: "discord:a", role: "model", text: "2" },
        { conversationKey: "whatsapp:b", role: "user", text: "3" },
    ]);
    await db.Reminder.create({ platform: "discord", conversationId: "a", userId: "u", text: "r", dueAt: new Date() });
    const adapters = new Map([["discord", { connected: true }], ["whatsapp", { connected: false }]]);
    const router = { stats: () => ({ handled: 5, failed: 1, lastError: null }) };
    const collect = createStatusCollector({ adapters, router, models: db, databasePath });
    return { db, collect, cleanup: () => rm(dir, { recursive: true }) };
}

test("status collector reports bot, data, process and system", async () => {
    const { collect, cleanup } = await collectorSetup();
    const status = await collect();
    await cleanup();

    assert.deepEqual(status.bot.platforms, [{ name: "discord", connected: true }, { name: "whatsapp", connected: false }]);
    assert.equal(status.bot.settings.model, "gemini-test");
    assert.equal(status.bot.prompt, "Cat");
    assert.equal(status.bot.handled, 5);
    assert.deepEqual(
        { ...status.data, lastMessageAt: typeof status.data.lastMessageAt },
        { messages: 3, conversations: 2, lastMessageAt: "object", reminders: 1, databaseBytes: 2048 },
    );
    assert.ok(status.process.rssBytes > 0);
    assert.ok(status.system.memory.totalBytes > 0);
    assert.ok(status.system.disk.totalBytes > 0);
    assert.equal(status.system.loadavg.length, 3);
});

test("a failing section is reported as an error without breaking the others", async () => {
    const { db, collect, cleanup } = await collectorSetup();
    db.Message.count = async () => { throw new Error("database is locked"); };
    const status = await collect();
    await cleanup();

    assert.deepEqual(status.data, { error: "database is locked" });
    assert.equal(status.bot.settings.model, "gemini-test");
    assert.ok(status.system.memory.totalBytes > 0);
});

async function serve(guard) {
    const app = express();
    app.use(statusRoutes({ getStatus: async () => ({ ok: true }), guard }));
    const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
    const base = `http://127.0.0.1:${server.address().port}`;
    return { base, close: () => new Promise((resolve) => server.close(resolve)) };
}

test("/status and /status.json are served behind the guard", async () => {
    const open = await serve((req, res, next) => next());
    const page = await fetch(`${open.base}/status`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /AI Bot 状态/);
    const json = await fetch(`${open.base}/status.json`);
    assert.equal(json.headers.get("cache-control"), "no-store");
    assert.deepEqual(await json.json(), { ok: true });
    await open.close();

    const closed = await serve((req, res) => res.status(403).send("no"));
    assert.equal((await fetch(`${closed.base}/status`)).status, 403);
    assert.equal((await fetch(`${closed.base}/status.json`)).status, 403);
    await closed.close();
});

import { assess } from "../src/services/status.js";
import { oracleTrouble, healthy, NOW } from "./fixtures/status.js";

test("assess: a healthy server has no problems", () => {
    const health = assess(healthy(), NOW);
    assert.equal(health.overall, "good");
    assert.deepEqual(health.problems, []);
    assert.deepEqual(health.levels, { memory: "good", swap: "good", disk: "good", load: "good" });
});

test("assess: critical problems come first, then warnings", () => {
    const health = assess(oracleTrouble(), NOW);
    assert.equal(health.overall, "critical");
    assert.deepEqual(health.problems.map((p) => p.level), ["critical", "warning", "warning", "warning"]);
    assert.equal(health.problems[0].text, "WhatsApp 未连接");
    assert.match(health.problems[1].text, /42 分钟前/);
    assert.match(health.problems.map((p) => p.text).join("\n"), /内存可用只剩 160 MB[\s\S]*没有开启 swap/);
    assert.deepEqual(health.levels, { memory: "warning", swap: "warning", disk: "good", load: "good" });
});

test("assess: an old error, a dev Mac's memory figure and an unreadable section", () => {
    const status = healthy();
    status.bot.lastError = { at: new Date(NOW - 3 * 86400_000).toISOString(), message: "old" };
    status.system.memory = { totalBytes: 48 * 1024 ** 3, availableBytes: 200 * 1024 ** 2, swapTotalBytes: null, swapFreeBytes: null };
    assert.equal(assess(status, NOW).overall, "good", "errors older than a day and non-Linux memory are not flagged");

    status.data = { error: "database is locked" };
    status.system = { error: "EACCES" };
    const health = assess(status, NOW);
    assert.equal(health.overall, "critical");
    assert.deepEqual(health.problems.map((p) => p.text), ["数据库读取失败", "服务器信息读取失败"]);
    assert.deepEqual(health.levels, { memory: null, swap: null, disk: null, load: null });
});

test("assess: high swap use, full disk, heavy load and a bloated process", () => {
    const status = healthy();
    status.system.memory.swapFreeBytes = 0.1 * status.system.memory.swapTotalBytes;
    status.system.disk.freeBytes = 1 * 1024 ** 3;
    status.system.loadavg = [4, 4, 4];
    status.process.rssBytes = 500 * 1024 ** 2;
    const health = assess(status, NOW);
    assert.deepEqual(health.levels, { memory: "good", swap: "critical", disk: "critical", load: "critical" });
    assert.equal(health.problems.length, 4);
    assert.match(health.problems.at(-1).text, /接近 pm2 自动重启线/);
});
