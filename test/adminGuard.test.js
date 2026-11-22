import test from "node:test";
import assert from "node:assert/strict";

process.env.GEMINI_API_KEY ||= "test-key";
const { adminGuard } = await import("../src/server.js");

function run(guard, { headers = {}, remoteAddress = "127.0.0.1" } = {}) {
    const result = { status: 200, nexted: false };
    const res = {
        set() { return res; },
        status(code) { result.status = code; return res; },
        send() { return res; },
    };
    guard({ headers, socket: { remoteAddress } }, res, () => { result.nexted = true; });
    return result;
}

const basic = (user, pass) => ({ authorization: "Basic " + Buffer.from(`${user}:${pass}`).toString("base64") });

test("with a password: correct credentials pass, everything else gets 401", () => {
    const guard = adminGuard({ user: "admin", password: "s3cret:x" });
    assert.equal(run(guard, { headers: basic("admin", "s3cret:x") }).nexted, true);
    assert.equal(run(guard, { headers: basic("admin", "wrong") }).status, 401);
    assert.equal(run(guard, { headers: basic("root", "s3cret:x") }).status, 401);
    assert.equal(run(guard).status, 401);
});

test("without a password: only direct local requests pass", () => {
    const guard = adminGuard({ user: "admin", password: undefined });
    assert.equal(run(guard).nexted, true);
    assert.equal(run(guard, { remoteAddress: "203.0.113.5" }).status, 403);
    assert.equal(run(guard, { headers: { "x-forwarded-for": "203.0.113.5" } }).status, 403);
});
