// src/adapters/discord/commands/status.js
import {
    SlashCommandBuilder,
    EmbedBuilder,
    MessageFlags,
    PermissionFlagsBits,
    InteractionContextType,
} from 'discord.js';
import { ago, bytes, duration, num, platformName } from '../../../utils/format.js';

const COLORS = { good: 0x0ca30c, warning: 0xfab219, critical: 0xd03b3b };
const ICONS = { good: '✅', warning: '⚠️', critical: '❌' };
const TITLES = { good: '一切正常', warning: '需要注意', critical: '有异常' };
// Discord rejects embed field values that are empty or longer than 1024 characters
const fieldValue = (text) => (String(text ?? '').trim() || '—').slice(0, 1024);
const icon = (lvl) => (lvl ? ICONS[lvl] + ' ' : '');

/**
 * The compact, phone-friendly version of the /status web page.
 * @param {object} status the result of createStatusCollector()() (src/services/status.js)
 */
export function buildStatusEmbed(status, now = Date.now()) {
    const { bot, system, process: proc, data, health } = status;
    const fields = [];

    if (bot.error) {
        fields.push({ name: '机器人', value: `❌ 读取失败：${bot.error}` });
    } else {
        const s = bot.settings;
        fields.push(
            {
                name: '平台',
                value: bot.platforms.length
                    ? bot.platforms.map((p) => `${platformName(p.name)} ${p.connected ? '✅' : '❌'}`).join('\n')
                    : '⚠️ 未配置',
                inline: true,
            },
            { name: '模型', value: s ? `${s.model}\ntemperature ${s.temperature}` : '—', inline: true },
            { name: '个性', value: bot.prompt ?? '默认', inline: true },
            {
                name: '本次启动后',
                value: `处理 ${num(bot.handled)} 条\n失败 ${num(bot.failed)} 条`,
                inline: true,
            },
        );
    }

    if (system.error) {
        fields.push({ name: '服务器', value: `❌ 读取失败：${system.error}` });
    } else {
        const m = system.memory;
        const { levels } = health;
        let swap = '—';
        if (m.swapTotalBytes === 0) swap = '⚠️ 未开启';
        else if (m.swapTotalBytes) swap = `${icon(levels.swap)}已用 ${bytes(m.swapTotalBytes - m.swapFreeBytes)} / ${bytes(m.swapTotalBytes)}`;
        const [l1, l5, l15] = system.loadavg.map((n) => n.toFixed(2));
        fields.push(
            { name: '内存', value: `${icon(levels.memory)}可用 ${bytes(m.availableBytes)} / ${bytes(m.totalBytes)}`, inline: true },
            { name: 'Swap', value: swap, inline: true },
            {
                name: '磁盘',
                value: system.disk ? `${icon(levels.disk)}剩余 ${bytes(system.disk.freeBytes)} / ${bytes(system.disk.totalBytes)}` : '—',
                inline: true,
            },
            { name: '负载', value: `${icon(levels.load)}${l1} / ${l5} / ${l15}\n${system.cpus} 个 CPU`, inline: true },
        );
    }

    fields.push({
        name: '运行时长',
        value: `机器人 ${duration(proc.uptimeSec)}` + (system.error ? '' : `\n服务器 ${duration(system.uptimeSec)}`),
        inline: true,
    });
    fields.push({ name: '机器人内存', value: bytes(proc.rssBytes), inline: true });

    fields.push(data.error
        ? { name: '数据', value: `❌ 读取失败：${data.error}` }
        : {
            name: '数据',
            value: `${num(data.messages)} 条消息 · ${num(data.conversations)} 个会话 · ${num(data.reminders)} 个待发提醒\n` +
                `最近一条消息：${data.lastMessageAt ? ago(data.lastMessageAt, now) : '还没有'}`,
        });

    if (!bot.error && bot.lastError) {
        fields.push({ name: '最近一次回复失败', value: `${ago(bot.lastError.at, now)}：${bot.lastError.message}` });
    }

    const embed = new EmbedBuilder()
        .setColor(COLORS[health.overall])
        .setTitle(`${ICONS[health.overall]} ${TITLES[health.overall]}`)
        .addFields(fields.map((field) => ({ ...field, value: fieldValue(field.value) })))
        .setFooter({ text: '完整版：网页 /status（通过 SSH 隧道打开）' })
        .setTimestamp(new Date(status.time));
    if (health.problems.length) {
        embed.setDescription(health.problems.map((p) => `${ICONS[p.level]} ${p.text}`).join('\n').slice(0, 4096));
    }
    return embed;
}

export const statusCommand = {
    data: new SlashCommandBuilder()
        .setName('status')
        .setDescription('Show bot and server status (only you see the reply)')
        .setDescriptionLocalizations({
            'zh-CN': '查看机器人和服务器状态（只有你能看到）',
            'zh-TW': '查看機器人和伺服器狀態（只有你能看到）',
        })
        // Model name, error messages and server load are for the owner: by default only members
        // who can manage the server see this command (adjustable in Server Settings → Integrations)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setContexts(InteractionContextType.Guild),

    async execute(interaction, services) {
        const status = await services.getStatus();
        await interaction.reply({ embeds: [buildStatusEmbed(status)], flags: MessageFlags.Ephemeral });
    },
};
