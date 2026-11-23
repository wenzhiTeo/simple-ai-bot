import test from "node:test";
import assert from "node:assert/strict";

process.env.GEMINI_API_KEY ||= "test-key";
const { WhatsAppAdapter, isOwnSelfChatMessage, messageText, toJid } = await import("../src/adapters/whatsapp/index.js");

const me = { id: "60123456789:12@s.whatsapp.net", lid: "98765432101234:12@lid" };

test("only messages you send to your own chat count, by phone number or LID", () => {
    assert.equal(isOwnSelfChatMessage({ fromMe: true, remoteJid: "60123456789@s.whatsapp.net" }, me), true);
    assert.equal(isOwnSelfChatMessage({ fromMe: true, remoteJid: "98765432101234@lid" }, me), true);
    assert.equal(isOwnSelfChatMessage({ fromMe: true, remoteJid: "111@lid", remoteJidAlt: "60123456789@s.whatsapp.net" }, me), true);

    // A friend writing to you, you writing to a friend, groups, status
    assert.equal(isOwnSelfChatMessage({ fromMe: false, remoteJid: "60123456789@s.whatsapp.net" }, me), false);
    assert.equal(isOwnSelfChatMessage({ fromMe: true, remoteJid: "60199999999@s.whatsapp.net" }, me), false);
    assert.equal(isOwnSelfChatMessage({ fromMe: true, remoteJid: "120363000000@g.us" }, me), false);
    assert.equal(isOwnSelfChatMessage({ fromMe: true, remoteJid: "status@broadcast" }, me), false);
    assert.equal(isOwnSelfChatMessage({ fromMe: true, remoteJid: "60123456789@s.whatsapp.net" }, undefined), false);
});

test("text comes from plain text, extended text or captions", () => {
    assert.equal(messageText({ conversation: " hi " }), "hi");
    assert.equal(messageText({ extendedTextMessage: { text: "link" } }), "link");
    assert.equal(messageText({ imageMessage: { caption: "水电费" } }), "水电费");
    assert.equal(messageText({}), "");
});

test("phone numbers become JIDs, JIDs are kept", () => {
    assert.equal(toJid("+60 12-345 6789"), "60123456789@s.whatsapp.net");
    assert.equal(toJid("120363000000@g.us"), "120363000000@g.us");
});

function adapter() {
    const a = new WhatsAppAdapter({ config: { WHATSAPP_AUTH_DIR: "unused", WHATSAPP_PHONE: "60123456789" } });
    a.sock = { user: me };
    return a;
}

const own = (message) => ({ key: { fromMe: true, remoteJid: "60123456789@s.whatsapp.net", id: "X" }, message });

test("normalize: self-chat text and images become IncomingMessages", () => {
    const a = adapter();
    const text = a.normalize(own({ conversation: "水电费 wifi 100" }));
    assert.equal(text.platform, "whatsapp");
    assert.equal(text.text, "水电费 wifi 100");
    assert.equal(text.isGroup, false);

    const image = a.normalize(own({ imageMessage: { mimetype: "image/jpeg", caption: "水电费" } }));
    assert.equal(image.images.length, 1);
    assert.equal(image.images[0].mimeType, "image/jpeg");

    const pdf = a.normalize(own({ documentMessage: { mimetype: "application/pdf" } }));
    assert.equal(pdf.images[0].mimeType, "application/pdf");
});

test("normalize ignores other chats, the bot's own replies, and empty or unsupported messages", () => {
    const a = adapter();
    assert.equal(a.normalize({ key: { fromMe: false, remoteJid: "60199999999@s.whatsapp.net" }, message: { conversation: "hi" } }), null);
    assert.equal(a.normalize(own({ conversation: "🤖 📝 草稿" })), null);
    assert.equal(a.normalize(own({ stickerMessage: { mimetype: "image/webp" } })), null);
    assert.equal(a.normalize(own({ documentMessage: { mimetype: "application/zip" } })), null);
    assert.equal(a.normalize(own(null)), null);
});

test("replies in your own chat are prefixed so the bot never answers itself", async () => {
    const a = adapter();
    const sent = [];
    a.connected = true;
    a.sock.sendMessage = async (jid, content) => { sent.push({ jid, content }); };
    await a.normalize(own({ conversation: "hi" })).reply("hello");
    await a.send("60111111111", "bill");
    assert.deepEqual(sent, [
        { jid: "60123456789@s.whatsapp.net", content: { text: "🤖 hello" } },
        { jid: "60111111111@s.whatsapp.net", content: { text: "bill" } },
    ]);
});
