import test from "node:test";
import assert from "node:assert/strict";
import { createBillSkill } from "../src/skills/bills/index.js";
import { createTestDb, silentLogger } from "./helpers.js";

async function setup({ recipient = "60111111111", extracted, now = new Date(2026, 8, 20) } = {}) {
    const { Bill } = await createTestDb();
    const sent = [];
    const adapters = new Map([["whatsapp", { send: async (to, text) => { sent.push({ to, text }); } }]]);
    const ai = {
        extractCalls: 0,
        async extractJson() {
            this.extractCalls++;
            if (extracted instanceof Error) throw extracted;
            return extracted;
        },
    };
    let clock = now;
    const skill = createBillSkill({
        ai, Bill, adapters, recipient, people: 2, platforms: ["whatsapp"],
        now: () => clock, logger: silentLogger,
    });

    const replies = [];
    const say = (text, extra = {}) => skill.handle({
        platform: "whatsapp", conversationId: "me", userId: "me", text,
        reply: async (r) => { replies.push(r); }, ...extra,
    }, { key: "whatsapp:me" });

    return { skill, say, replies, sent, Bill, ai, advance: (ms) => { clock = new Date(+clock + ms); } };
}

const photo = { mimeType: "image/jpeg", load: async () => Buffer.from("jpeg") };

test("text bill -> preview -> confirm sends exactly the bill and saves it", async () => {
    const { say, replies, sent, Bill } = await setup();

    assert.equal(await say("水电费 9月 wifi 100 水 6.50 电 25.6"), true);
    assert.equal(sent.length, 0, "nothing is sent before confirming");
    assert.match(replies[0], /草稿/);
    assert.match(replies[0], /总计 RM66\.05/);

    assert.equal(await say("确认"), true);
    assert.deepEqual(sent, [{
        to: "60111111111",
        text: "水电费\n2026 年 9 月\nWi-Fi = 100.00 / 2 = 50.00\n水费 = 6.50 / 2 = 3.25\n电费 = 25.60 / 2 = 12.80\n总计 RM66.05",
    }]);
    const saved = await Bill.findOne();
    assert.equal(saved.totalCents, 6605);
    assert.equal(saved.month, 9);

    // The draft is gone: a second 确认 is just normal chat
    assert.equal(await say("确认"), false);
});

test("corrections, removals and cancel while a draft is open", async () => {
    const { say, replies, sent } = await setup();
    await say("水电费 wifi 100 电 25.6");

    await say("电 30");
    assert.match(replies.at(-1), /电费 = 30\.00 \/ 2 = 15\.00/);

    await say("删 wifi");
    assert.doesNotMatch(replies.at(-1), /Wi-Fi/);

    await say("取消");
    assert.equal(await say("确认"), false);
    assert.equal(sent.length, 0);
});

test("other messages fall through to chat and keep the draft", async () => {
    const { say } = await setup();
    await say("水电费 wifi 100");
    assert.equal(await say("今天天气怎么样"), false);
    assert.equal(await say("确认"), true);
});

test("bill photos are read by the model and merged; the printed month is used", async () => {
    const { say, replies, ai } = await setup({
        extracted: { items: [{ category: "electricity", name: "TNB", amount: 25.6 }, { category: "other", name: "Indah Water", amount: 8 }], year: 2026, month: 8 },
    });

    await say("水电费", { images: [photo] });
    assert.equal(ai.extractCalls, 1);
    assert.match(replies.at(-1), /2026 年 8 月/);
    assert.match(replies.at(-1), /电费 = 25\.60/);
    assert.match(replies.at(-1), /Indah Water = 8\.00/);

    // A photo sent later (no caption) is added to the open draft
    await say("", { images: [photo] });
    assert.equal(ai.extractCalls, 2);
});

test("a month typed by the user wins over the month read from the photo", async () => {
    const { say, replies } = await setup({ extracted: { items: [{ category: "water", name: "Air Selangor", amount: 6.5 }], year: 2026, month: 8 } });
    await say("水电费 9月", { images: [photo] });
    assert.match(replies.at(-1), /2026 年 9 月/);
});

test("unreadable photos give a clear message instead of a bill", async () => {
    const { say, replies } = await setup({ extracted: new Error("model down") });
    await say("水电费", { images: [photo] });
    assert.match(replies.at(-1), /图片识别失败/);
    assert.match(replies.at(-1), /用法/);
});

test("no recipient configured: preview works, sending is refused", async () => {
    const { say, replies, sent } = await setup({ recipient: null });
    await say("水电费 wifi 100");
    assert.match(replies.at(-1), /BILL_RECIPIENT/);
    await say("确认");
    assert.equal(sent.length, 0);
});

test("drafts expire after 6 hours", async () => {
    const { say, advance } = await setup();
    await say("水电费 wifi 100");
    advance(6 * 60 * 60 * 1000 + 1);
    assert.equal(await say("确认"), false);
});

test("other platforms cannot use the skill", async () => {
    const { skill } = await setup();
    const handled = await skill.handle({ platform: "discord", text: "水电费 wifi 100", reply: async () => {} }, { key: "discord:c" });
    assert.equal(handled, false);
});
