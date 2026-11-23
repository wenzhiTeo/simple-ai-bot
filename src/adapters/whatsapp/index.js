import { chmod, mkdir } from "node:fs/promises";
import makeWASocket, {
    DisconnectReason,
    areJidsSameUser,
    downloadMediaMessage,
    isJidGroup,
    normalizeMessageContent,
    useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import pino from "pino";

/** Every message the bot writes into your own chat starts with this, so it never answers itself. */
export const BOT_PREFIX = "🤖 ";

const SUPPORTED_ATTACHMENT = /^(image\/(jpeg|png|webp)|application\/pdf)/;
const MAX_RECONNECT_DELAY_MS = 60_000;

/** "60123456789" / "+60 12-345 6789" -> "60123456789@s.whatsapp.net"; full JIDs are kept. */
export function toJid(id) {
    const value = String(id).trim();
    return value.includes("@") ? value : `${value.replace(/\D/g, "")}@s.whatsapp.net`;
}

/**
 * Is this message something you sent to your own "Message yourself" chat?
 * WhatsApp may address that chat by phone number or by LID, so both are checked.
 */
export function isOwnSelfChatMessage(key, me) {
    if (!key?.fromMe || !me) return false;
    const myIds = [me.id, me.lid].filter(Boolean);
    const chatIds = [key.remoteJid, key.remoteJidAlt].filter(Boolean);
    return chatIds.some((chat) => !isJidGroup(chat) && myIds.some((mine) => areJidsSameUser(chat, mine)));
}

/** Text of a message: plain text, extended text, or a media caption. */
export function messageText(content) {
    return (
        content?.conversation ??
        content?.extendedTextMessage?.text ??
        content?.imageMessage?.caption ??
        content?.documentMessage?.caption ??
        ""
    ).trim();
}

/**
 * WhatsApp via Baileys, logged in as a linked device of YOUR number.
 *
 * Because the bot is you, it must not react to anyone else's messages: it only
 * listens to your own "Message yourself" chat. Messages to other people are
 * sent only through send() (e.g. a confirmed bill).
 *
 * Adapter contract: see src/adapters/discord/index.js.
 */
export class WhatsAppAdapter {
    name = "whatsapp";

    constructor({ config, logger = console }) {
        this.config = config;
        this.logger = logger;
        this.sock = null;
        this.connected = false;
        this.pairingRequested = false;
        this.reconnectAttempts = 0;
        this.baileysLogger = pino({ level: config.ENABLE_DEBUG_LOGS ? "info" : "error" });
    }

    /** Returns once the socket is created; connecting (and pairing) continues in the background. */
    async start(onMessage) {
        this.onMessage = onMessage;
        const dir = this.config.WHATSAPP_AUTH_DIR;
        await mkdir(dir, { recursive: true, mode: 0o700 });
        await chmod(dir, 0o700); // the session files are full access to your WhatsApp account
        await this.connect();
    }

    async connect() {
        const { state, saveCreds } = await useMultiFileAuthState(this.config.WHATSAPP_AUTH_DIR);
        const sock = makeWASocket({
            auth: state,
            logger: this.baileysLogger,
            // Keep notifications on your phone, and skip downloading old chats
            markOnlineOnConnect: false,
            syncFullHistory: false,
            shouldSyncHistoryMessage: () => false,
            // Don't echo the bot's own sends back as incoming messages
            emitOwnEvents: false,
        });
        this.sock = sock;
        this.pairingRequested = false;

        sock.ev.on("creds.update", saveCreds);
        sock.ev.on("connection.update", (update) => this.onConnectionUpdate(sock, update));
        sock.ev.on("messages.upsert", ({ messages, type }) => {
            // "notify" = just arrived. "append" is history, offline backlog or our own sends.
            if (type !== "notify") return;
            for (const raw of messages) {
                const incoming = this.normalize(raw);
                if (incoming) this.onMessage(incoming);
            }
        });
    }

    async onConnectionUpdate(sock, { connection, lastDisconnect, qr }) {
        if (sock !== this.sock) return; // an old socket we already replaced

        // Not linked yet: the socket is ready to pair as soon as it offers a QR code
        if (qr && !sock.authState.creds.registered && !this.pairingRequested) {
            this.pairingRequested = true;
            await this.requestPairingCode(sock);
        }

        if (connection === "open") {
            this.connected = true;
            this.reconnectAttempts = 0;
            this.logger.log(`✅ WhatsApp connected as ${sock.user?.id}`);
            return;
        }

        if (connection === "close") {
            this.connected = false;
            const status = lastDisconnect?.error?.output?.statusCode;

            if (status === DisconnectReason.loggedOut) {
                this.logger.error(
                    "❌ WhatsApp logged out (device removed on the phone). " +
                    `Delete the "${this.config.WHATSAPP_AUTH_DIR}" folder and restart to link again.`
                );
                return;
            }

            // restartRequired is a normal step right after linking: reconnect immediately
            const delay = status === DisconnectReason.restartRequired
                ? 0
                : Math.min(1000 * 2 ** this.reconnectAttempts++, MAX_RECONNECT_DELAY_MS);
            if (delay) this.logger.warn(`⚠️ WhatsApp disconnected (${status ?? "unknown"}), retrying in ${delay / 1000}s`);
            setTimeout(() => this.connect().catch((error) => {
                this.logger.error("❌ WhatsApp reconnect failed:", error);
            }), delay);
        }
    }

    async requestPairingCode(sock) {
        const phone = this.config.WHATSAPP_PHONE.replace(/\D/g, "");
        try {
            const code = await sock.requestPairingCode(phone);
            const pretty = code.match(/.{1,4}/g).join("-");
            this.logger.log([
                "",
                "📱 WhatsApp pairing code: " + pretty,
                "   On your phone: WhatsApp → Settings → Linked devices → Link a device",
                "   → \"Link with phone number instead\", then enter the code above.",
                "",
            ].join("\n"));
        } catch (error) {
            this.logger.error("❌ Could not get a WhatsApp pairing code:", error.message);
        }
    }

    /** Baileys message -> IncomingMessage (see core/router.js), or null to ignore it. */
    normalize(raw) {
        if (!isOwnSelfChatMessage(raw.key, this.sock?.user)) return null;

        const content = normalizeMessageContent(raw.message);
        if (!content) return null;

        const text = messageText(content);
        if (text.startsWith(BOT_PREFIX.trim())) return null;

        const media = content.imageMessage ?? content.documentMessage;
        const mimeType = media?.mimetype ?? "";
        const images = SUPPORTED_ATTACHMENT.test(mimeType)
            ? [{
                mimeType: mimeType.split(";")[0],
                load: () => downloadMediaMessage(raw, "buffer", {}, {
                    logger: this.baileysLogger,
                    reuploadRequest: this.sock.updateMediaMessage,
                }),
            }]
            : [];

        if (!text && images.length === 0) return null;

        const chat = raw.key.remoteJid;
        return {
            platform: this.name,
            conversationId: chat,
            userId: chat,
            isGroup: false,
            text,
            images,
            reply: (reply) => this.sendText(chat, BOT_PREFIX + reply),
        };
    }

    async sendText(jid, text) {
        if (!this.connected) throw new Error("WhatsApp is not connected");
        return this.sock.sendMessage(jid, { text });
    }

    /** Send to anyone: a phone number with country code ("60123456789") or a full JID. */
    async send(conversationId, text) {
        return this.sendText(toJid(conversationId), text);
    }

    mention() {
        return "";
    }
}
