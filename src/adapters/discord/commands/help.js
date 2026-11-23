// src/commands/help.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const helpCommand = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show all available commands'),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('🤖 Bot Commands')
            .setDescription('Here are all the available commands:')
            .addFields(
                {
                    name: '🏓 /ping',
                    value: 'Check bot latency and status',
                    inline: true
                },
                {
                    name: '⏰ /remind',
                    value: 'Set a reminder for a specific time\nUsage: `/remind time:1430 message:Meeting`',
                    inline: true
                },
                {
                    name: '📋 /reminders',
                    value: 'List all your active reminders',
                    inline: true
                },
                {
                    name: '🗑️ /clear-reminders',
                    value: 'Clear all your active reminders',
                    inline: true
                },
                {
                    name: '🧹 /reset',
                    value: "Clear the bot's memory of this channel's conversation",
                    inline: true
                },
                {
                    name: '🩺 /status',
                    value: 'Bot and server status, only you see it (server managers only)',
                    inline: true
                },
                {
                    name: '❓ /help',
                    value: 'Show this help message',
                    inline: true
                }
            )
            .setFooter({ text: 'Bot made with ❤️' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed]});
    }
};