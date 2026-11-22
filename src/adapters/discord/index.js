import { once } from "node:events";
import { Client, Events, GatewayIntentBits } from "discord.js";
import CommandHandler from "./commandHandler.js";
import { splitMessage } from "../../utils/text.js";
import { downloadBuffer } from "../../utils/download.js";

const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

/**
 * Everything Discord-specific lives in this folder.
 *
 * Adapter contract (the same for every platform):
 *   name                          unique platform name
 *   start(onMessage)              connect and call onMessage(IncomingMessage) for each user message
 *   send(conversationId, text)    post a message that is not a reply (reminders, announcements)
 *   mention(userId)               platform syntax for pinging a user
 */
export class DiscordAdapter {
    name = "discord";

    constructor({ config, services }) {
        this.config = config;
        this.services = services;
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildMembers,
            ],
        });
    }

    /** Resolves once the bot is logged in and ready. */
    async start(onMessage) {
        const ready = once(this.client, Events.ClientReady);
        await this.client.login(this.config.DISCORD_TOKEN);
        await ready;
        console.log(`✅ Discord bot ready: ${this.client.user.tag}`);

        const commandHandler = new CommandHandler(this.client, this.config.DISCORD_TOKEN);
        commandHandler.setupListeners(this.services);
        await commandHandler.registerCommands().catch(() => {});

        this.client.on(Events.MessageCreate, (message) => {
            const incoming = this.normalize(message);
            if (incoming) onMessage(incoming);
        });
    }

    /** Discord message -> IncomingMessage (see core/router.js), or null to ignore it. */
    normalize(message) {
        const { config, client } = this;
        if (message.author.bot || message.system) return null;
        if (config.BLACKLISTED_CHANNEL_IDS.includes(message.channel.id)) return null;
        if (config.IS_MENTION_ONLY && !message.mentions.has(client.user)) return null;

        const text = message.content
            .replaceAll(new RegExp(`<@!?${client.user.id}>`, "g"), "")
            .trim();

        const images = [...message.attachments.values()]
            .filter((attachment) => SUPPORTED_IMAGE_TYPES.includes(attachment.contentType))
            .map((attachment) => ({
                mimeType: attachment.contentType,
                load: () => downloadBuffer(attachment.url, {
                    timeout: config.IMAGE_DOWNLOAD_TIMEOUT,
                    retries: config.IMAGE_DOWNLOAD_RETRIES,
                }),
            }));

        if (!text && images.length === 0) return null;

        return {
            platform: this.name,
            conversationId: message.channel.id,
            userId: message.author.id,
            userName: message.member?.displayName ?? message.author.username,
            isGroup: message.inGuild(),
            text,
            images,
            typing: () => message.channel.sendTyping(),
            reply: (content) => this.reply(message, content),
        };
    }

    async reply(message, content) {
        const [first, ...rest] = splitMessage(content, this.config.MAX_MESSAGE_LENGTH);
        if (!first) return;
        await message.reply({ content: first, allowedMentions: { repliedUser: false } });
        for (const chunk of rest) await message.channel.send(chunk);
    }

    async send(conversationId, content) {
        const channel = await this.client.channels.fetch(conversationId);
        for (const chunk of splitMessage(content, this.config.MAX_MESSAGE_LENGTH)) {
            await channel.send(chunk);
        }
    }

    mention(userId) {
        return `<@${userId}>`;
    }
}
