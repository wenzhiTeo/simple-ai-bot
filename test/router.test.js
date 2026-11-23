import test from "node:test";
import assert from "node:assert/strict";
import { createRouter } from "../src/core/router.js";
import { createConversationStore } from "../src/core/conversationStore.js";
import { createTestDb, silentLogger } from "./helpers.js";

async function setup({ generate, limit, getSettings } = {}) {
    const { Message } = await createTestDb();
    const calls = [];
    const ai = {
        async generate(input) {
            calls.push(input);
            return generate ? generate(input) : `echo: ${input.text}`;
        },
    };
    const store = createConversationStore(Message, { limit });
    const router = createRouter({ ai, store, getSystemPrompt: async () => "SYSTEM", getSettings, logger: silentLogger });
    return { router, calls, store, Message };
}

function incoming(overrides = {}) {
    const replies = [];
    return {
        replies,
        platform: "discord",
        conversationId: "c1",
        userId: "u1",
        userName: "Ann",
        text: "hi",
        reply: async (text) => { replies.push(text); },
        ...overrides,
    };
}

test("replies and passes the system prompt", async () => {
    const { router, calls } = await setup();
    const message = incoming();
    await router.handle(message);

    assert.deepEqual(message.replies, ["echo: hi"]);
    assert.equal(calls[0].system, "SYSTEM");
    assert.deepEqual(calls[0].history, []);
});

test("history is kept per conversation and per platform", async () => {
    const { router, calls } = await setup();
    await router.handle(incoming({ text: "first" }));
    await router.handle(incoming({ text: "second" }));
    await router.handle(incoming({ conversationId: "c2", text: "other channel" }));
    await router.handle(incoming({ platform: "whatsapp", text: "other platform" }));

    assert.deepEqual(calls[1].history, [
        { role: "user", text: "first" },
        { role: "model", text: "echo: first" },
    ]);
    assert.deepEqual(calls[2].history, []);
    assert.deepEqual(calls[3].history, []);
});

test("concurrent messages in one conversation are processed in order", async () => {
    const { router, calls } = await setup({
        generate: async ({ text }) => {
            if (text === "slow") await new Promise((r) => setTimeout(r, 30));
            return `re: ${text}`;
        },
    });
    await Promise.all([
        router.handle(incoming({ text: "slow" })),
        router.handle(incoming({ text: "fast" })),
    ]);

    assert.deepEqual(calls[1].history, [
        { role: "user", text: "slow" },
        { role: "model", text: "re: slow" },
    ]);
});

test("history is capped and always starts with a user turn", async () => {
    const { router, calls } = await setup({ limit: 3 });
    for (const text of ["a", "b", "c"]) await router.handle(incoming({ text }));

    assert.deepEqual(calls[2].history, [
        { role: "user", text: "b" },
        { role: "model", text: "echo: b" },
    ]);
});

test("historyLimit from settings overrides the store limit, read on every message", async () => {
    let historyLimit = 0;
    const { router, calls } = await setup({ limit: 20, getSettings: async () => ({ historyLimit }) });
    for (const text of ["a", "b"]) await router.handle(incoming({ text }));
    assert.deepEqual(calls[1].history, []);

    historyLimit = 2;
    await router.handle(incoming({ text: "c" }));
    assert.deepEqual(calls[2].history, [
        { role: "user", text: "b" },
        { role: "model", text: "echo: b" },
    ]);
});

test("missing settings fall back to the store limit", async () => {
    const { router, calls } = await setup({ getSettings: async () => null });
    await router.handle(incoming({ text: "a" }));
    await router.handle(incoming({ text: "b" }));
    assert.equal(calls[1].history.length, 2);
});

test("group messages are prefixed with the speaker's name", async () => {
    const { router, calls } = await setup();
    await router.handle(incoming({ isGroup: true }));
    assert.equal(calls[0].text, "Ann: hi");
});

test("images are downloaded and passed to the model, history keeps a marker", async () => {
    const { router, calls, Message } = await setup({ generate: () => "a cat" });
    const data = Buffer.from("png-bytes");
    await router.handle(incoming({ text: "what is this", images: [{ mimeType: "image/png", load: async () => data }] }));

    assert.deepEqual(calls[0].images, [{ mimeType: "image/png", data }]);
    const saved = await Message.findOne({ where: { role: "user" } });
    assert.equal(saved.text, "what is this [图片]");
});

test("an image-only message whose download fails gets a clear reply and no model call", async () => {
    const { router, calls } = await setup();
    const message = incoming({ text: "", images: [{ mimeType: "image/png", load: async () => { throw new Error("404"); } }] });
    await router.handle(message);

    assert.equal(calls.length, 0);
    assert.equal(message.replies.length, 1);
});

test("a model failure sends a fallback reply and stores nothing", async () => {
    const { router, Message } = await setup({ generate: () => { throw new Error("quota"); } });
    const message = incoming();
    await router.handle(message);

    assert.equal(message.replies.length, 1);
    assert.equal(await Message.count(), 0);
});

test("a skill that handles a message skips AI chat; otherwise chat runs", async () => {
    const { Message } = await (await import("./helpers.js")).createTestDb();
    const calls = [];
    const ai = { async generate(input) { calls.push(input); return "chat"; } };
    const skill = { name: "s", handle: async (message, { key }) => { calls.push(key); return message.text === "skill"; } };
    const router = createRouter({
        ai, store: createConversationStore(Message), getSystemPrompt: async () => "", skills: [skill], logger: silentLogger,
    });

    const a = incoming({ text: "skill" });
    await router.handle(a);
    assert.deepEqual(calls, ["discord:c1"]);
    assert.deepEqual(a.replies, []);

    const b = incoming({ text: "hello" });
    await router.handle(b);
    assert.deepEqual(b.replies, ["chat"]);
});
