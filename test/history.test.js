import test from "node:test";
import assert from "node:assert/strict";
import { createConversationStore } from "../src/core/conversationStore.js";
import { pruneHistory } from "../src/scheduler.js";
import { createTestDb } from "./helpers.js";

const DAY_MS = 24 * 60 * 60 * 1000;

async function seed() {
    const { Message } = await createTestDb();
    const store = createConversationStore(Message);
    const now = new Date(2026, 5, 15, 12, 0);
    const row = (conversationKey, daysAgo) =>
        ({ conversationKey, role: "user", text: `${daysAgo}d`, createdAt: new Date(now - daysAgo * DAY_MS) });
    await Message.bulkCreate([row("discord:a", 40), row("discord:a", 1), row("discord:b", 31), row("discord:b", 29)]);
    return { Message, store, now };
}

test("clear forgets one conversation and leaves the others", async () => {
    const { Message, store } = await seed();
    assert.equal(await store.clear("discord:a"), 2);
    assert.equal(await store.clear("discord:a"), 0);
    assert.equal(await Message.count({ where: { conversationKey: "discord:b" } }), 2);
});

test("pruneHistory deletes only messages older than the retention period", async () => {
    const { Message, store, now } = await seed();
    assert.equal(await pruneHistory(store, 30, now), 2);
    const left = (await Message.findAll({ order: [["id", "ASC"]] })).map((m) => m.text);
    assert.deepEqual(left, ["1d", "29d"]);
});

test("pruneHistory keeps everything when retention is 0", async () => {
    const { Message, store, now } = await seed();
    assert.equal(await pruneHistory(store, 0, now), 0);
    assert.equal(await Message.count(), 4);
});
