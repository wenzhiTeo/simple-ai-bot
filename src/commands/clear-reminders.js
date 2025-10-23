// src/commands/clear-reminders.js
import { SlashCommandBuilder } from 'discord.js';

export const clearRemindersCommand = {
    data: new SlashCommandBuilder()
        .setName('clear-reminders')
        .setDescription('Clear all your active reminders'),

    async execute(interaction, services) {
        try {
            const userReminders = services.reminderService.getUserReminders(interaction.user.id);

            if (userReminders.length === 0) {
                await interaction.reply({
                    content: '📭 You have no active reminders to clear.',
                });
                return;
            }

            const clearedCount = services.reminderService.clearUserReminders(interaction.user.id);

            await interaction.reply({
                content: `🗑️ Successfully cleared ${clearedCount} reminder(s).`,
            });
        } catch (error) {
            console.error('Error in clear-reminders command:', error);
            await interaction.reply({
                content: '❌ An error occurred while clearing your reminders.',
            });
        }
    }
};