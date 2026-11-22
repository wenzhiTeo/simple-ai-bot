// src/adapters/discord/commands/reset.js
import { SlashCommandBuilder } from 'discord.js';

export const resetCommand = {
    data: new SlashCommandBuilder()
        .setName('reset')
        .setDescription("Clear the bot's memory of this channel's conversation"),

    async execute(interaction, services) {
        const removed = await services.conversationStore.clear(`discord:${interaction.channelId}`);

        await interaction.reply({
            content: removed === 0
                ? '📭 Nothing to forget, this channel has no conversation history.'
                : `🧹 Forgot this channel's conversation (${removed} messages). Starting fresh!`,
        });
    }
};
