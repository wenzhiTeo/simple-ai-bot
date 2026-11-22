// src/adapters/discord/commands/clear-reminders.js
import { SlashCommandBuilder } from 'discord.js';

export const clearRemindersCommand = {
    data: new SlashCommandBuilder()
        .setName('clear-reminders')
        .setDescription('Clear all your active reminders'),

    async execute(interaction, services) {
        const cleared = await services.reminderService.clear('discord', interaction.user.id);

        await interaction.reply({
            content: cleared === 0
                ? '📭 You have no active reminders to clear.'
                : `🗑️ Successfully cleared ${cleared} reminder(s).`,
        });
    }
};
