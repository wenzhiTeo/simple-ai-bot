import test from "node:test";
import assert from "node:assert/strict";
import { parseClockTime, nextOccurrence, ReminderService } from "../src/services/reminder.js";
import { createTestDb, silentLogger } from "./helpers.js";

test("parseClockTime accepts HHMM and HMM", () => {
    assert.deepEqual(parseClockTime("1430"), { hours: 14, minutes: 30 });
    assert.deepEqual(parseClockTime("930"), { hours: 9, minutes: 30 });
    assert.deepEqual(parseClockTime("0000"), { hours: 0, minutes: 0 });
});

test("parseClockTime rejects bad input", () => {
    for (const bad of ["2460", "1260", "12", "12:30", "abcd", "", null]) {
        assert.equal(parseClockTime(bad), null, String(bad));
    }
});

test("nextOccurrence is today when the time is still ahead, tomorrow otherwise", () => {
    const now = new Date(2026, 0, 15, 12, 0, 0);
    assert.deepEqual(nextOccurrence({ hours: 14, minutes: 30 }, now), new Date(2026, 0, 15, 14, 30));
    assert.deepEqual(nextOccurrence({ hours: 9, minutes: 0 }, now), new Date(2026, 0, 16, 9, 0));
    assert.deepEqual(nextOccurrence({ hours: 12, minutes: 0 }, now), new Date(2026, 0, 16, 12, 0));
});

function fakeAdapter() {
    const sent = [];
    return {
        sent,
        mention: (userId) => `<@${userId}>`,
        send: async (conversationId, text) => { sent.push({ conversationId, text }); },
    };
}

test("checkDue delivers due reminders once and leaves future ones", async () => {
    const { Reminder } = await createTestDb();
    const discord = fakeAdapter();
    const service = new ReminderService({ Reminder, adapters: new Map([["discord", discord]]), logger: silentLogger });
    const now = new Date(2026, 0, 15, 12, 0);

    await service.create({ platform: "discord", conversationId: "c1", userId: "u1", text: "due", dueAt: new Date(now - 1000) });
    await service.create({ platform: "discord", conversationId: "c1", userId: "u1", text: "later", dueAt: new Date(+now + 60_000) });

    await service.checkDue(now);
    await service.checkDue(now);

    assert.deepEqual(discord.sent, [{ conversationId: "c1", text: "<@u1> ⏰ 提醒：due" }]);
    assert.deepEqual((await service.list("discord", "u1")).map((r) => r.text), ["later"]);
});

test("a reminder that fails to send is retried, then dropped after an hour", async () => {
    const { Reminder } = await createTestDb();
    const broken = { send: async () => { throw new Error("offline"); } };
    const service = new ReminderService({ Reminder, adapters: new Map([["discord", broken]]), logger: silentLogger });
    const dueAt = new Date(2026, 0, 15, 12, 0);
    await service.create({ platform: "discord", conversationId: "c1", userId: "u1", text: "x", dueAt });

    await service.checkDue(new Date(+dueAt + 60_000));
    assert.equal(await Reminder.count(), 1);

    await service.checkDue(new Date(+dueAt + 61 * 60_000));
    assert.equal(await Reminder.count(), 0);
});

test("list and clear only touch the given user on the given platform", async () => {
    const { Reminder } = await createTestDb();
    const service = new ReminderService({ Reminder, adapters: new Map(), logger: silentLogger });
    const dueAt = new Date(Date.now() + 3600_000);
    await service.create({ platform: "discord", conversationId: "c", userId: "u1", text: "a", dueAt });
    await service.create({ platform: "discord", conversationId: "c", userId: "u2", text: "b", dueAt });
    await service.create({ platform: "whatsapp", conversationId: "c", userId: "u1", text: "c", dueAt });

    assert.equal(await service.clear("discord", "u1"), 1);
    assert.equal(await Reminder.count(), 2);
});
