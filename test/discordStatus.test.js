import test from "node:test";
import assert from "node:assert/strict";
import { MessageFlags, PermissionFlagsBits, InteractionContextType } from "discord.js";
import { buildStatusEmbed, statusCommand } from "../src/adapters/discord/commands/status.js";
import { commandMap } from "../src/adapters/discord/commands/index.js";
import { assess } from "../src/services/status.js";
import { oracleTrouble, healthy, NOW } from "./fixtures/status.js";

const withHealth = (status) => ({ ...status, health: assess(status, NOW) });
const field = (embed, name) => embed.fields.find((f) => f.name === name)?.value;

test("embed for a server in trouble: red, problems listed, details in fields", () => {
    const embed = buildStatusEmbed(withHealth(oracleTrouble()), NOW).toJSON();
    assert.equal(embed.color, 0xd03b3b);
    assert.equal(embed.title, "❌ 有异常");
    assert.match(embed.description, /^❌ WhatsApp 未连接\n⚠️ 最近 24 小时内有回复失败/);
    assert.equal(field(embed, "平台"), "Discord ✅\nWhatsApp ❌");
    assert.equal(field(embed, "模型"), "gemini-2.5-pro\ntemperature 1.3");
    assert.equal(field(embed, "内存"), "⚠️ 可用 160 MB / 952 MB");
    assert.equal(field(embed, "Swap"), "⚠️ 未开启");
    assert.equal(field(embed, "磁盘"), "✅ 剩余 40.0 GB / 45.0 GB");
    assert.match(field(embed, "数据"), /1,534 条消息 · 6 个会话 · 2 个待发提醒\n最近一条消息：5 分钟前/);
    assert.equal(field(embed, "最近一次回复失败"), "42 分钟前：404 models/gemini-2.5-pr is not found for API version v1beta");
});

test("embed for a healthy server: green, no description, no error field", () => {
    const embed = buildStatusEmbed(withHealth(healthy()), NOW).toJSON();
    assert.equal(embed.color, 0x0ca30c);
    assert.equal(embed.title, "✅ 一切正常");
    assert.equal(embed.description, undefined);
    assert.equal(field(embed, "最近一次回复失败"), undefined);
    assert.equal(field(embed, "Swap"), "✅ 已用 20 MB / 2.0 GB");
});

test("embed survives unreadable sections and very long values within Discord limits", () => {
    const status = oracleTrouble();
    status.bot.lastError.message = "x".repeat(5000);
    status.system = { error: "EACCES" };
    status.data = { error: "database is locked" };
    const embed = buildStatusEmbed(withHealth(status), NOW).toJSON();

    assert.equal(field(embed, "服务器"), "❌ 读取失败：EACCES");
    assert.equal(field(embed, "数据"), "❌ 读取失败：database is locked");
    assert.equal(field(embed, "运行时长"), "机器人 3 天 5 小时");
    for (const f of embed.fields) {
        assert.ok(f.value.length > 0 && f.value.length <= 1024, `${f.name} has ${f.value.length} chars`);
    }
});

test("/status is registered, guild-only, managers-only by default, and replies privately", async () => {
    assert.equal(commandMap.get("status"), statusCommand);
    const data = statusCommand.data.toJSON();
    assert.equal(data.default_member_permissions, String(PermissionFlagsBits.ManageGuild));
    assert.deepEqual(data.contexts, [InteractionContextType.Guild]);

    const replies = [];
    const interaction = { reply: async (options) => { replies.push(options); } };
    await statusCommand.execute(interaction, { getStatus: async () => withHealth(healthy()) });
    assert.equal(replies.length, 1);
    assert.equal(replies[0].flags, MessageFlags.Ephemeral);
    assert.equal(replies[0].embeds[0].toJSON().title, "✅ 一切正常");
});
