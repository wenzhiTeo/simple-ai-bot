// src/adapters/discord/commands/remind.js
import { SlashCommandBuilder } from 'discord.js';
import { parseClockTime, nextOccurrence } from '../../../services/reminder.js';

export const remindCommand = {
    data: new SlashCommandBuilder()
        .setName('remind')
        .setDescription('Set a reminder for a specific time')
        .addStringOption(option =>
            option.setName('time')
                .setDescription('Time in HHMM format (e.g., 1430 for 2:30 PM)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('message')
                .setDescription('Reminder message')
                .setRequired(true)
        ),

    async execute(interaction, services) {
        const time = parseClockTime(interaction.options.getString('time'));
        const text = interaction.options.getString('message');

        if (!time) {
            await interaction.reply({
                content: '⚠️ Invalid time. Please use HHMM format, hours 0-23 and minutes 0-59 (e.g., 1430 for 2:30 PM)',
            });
            return;
        }

        const dueAt = nextOccurrence(time);
        await services.reminderService.create({
            platform: 'discord',
            conversationId: interaction.channelId,
            userId: interaction.user.id,
            text,
            dueAt,
        });

        // <t:…> is rendered by Discord in each viewer's own timezone
        const unix = Math.floor(dueAt.getTime() / 1000);
        await interaction.reply({
            content: `⏰ Reminder set for <t:${unix}:t> (<t:${unix}:R>)\n📝 Message: "${text}"`
        });
    }
};
