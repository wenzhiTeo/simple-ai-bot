// src/adapters/discord/commands/reminders.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const remindersCommand = {
    data: new SlashCommandBuilder()
        .setName('reminders')
        .setDescription('List all your active reminders'),

    async execute(interaction, services) {
        const reminders = await services.reminderService.list('discord', interaction.user.id);

        if (reminders.length === 0) {
            await interaction.reply({ content: '📭 You have no active reminders.' });
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('⏰ Your Active Reminders')
            .setDescription(`You have ${reminders.length} active reminder(s):`)
            .setTimestamp();

        // Discord allows at most 25 fields per embed
        reminders.slice(0, 25).forEach((reminder, index) => {
            const unix = Math.floor(reminder.dueAt.getTime() / 1000);
            embed.addFields({
                name: `${index + 1}. ${reminder.text.slice(0, 200)}`,
                value: `🕐 <t:${unix}:f> (<t:${unix}:R>)`,
                inline: false
            });
        });

        await interaction.reply({ embeds: [embed] });
    }
};
