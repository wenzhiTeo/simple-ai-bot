import test from "node:test";
import assert from "node:assert/strict";
import { splitMessage } from "../src/utils/text.js";

test("short text stays in one chunk", () => {
    assert.deepEqual(splitMessage("hello\nworld", 2000), ["hello\nworld"]);
});

test("empty text gives no chunks", () => {
    assert.deepEqual(splitMessage("   "), []);
    assert.deepEqual(splitMessage(undefined), []);
});

test("long text is split at newlines and keeps the newlines inside chunks", () => {
    const line = "x".repeat(40);
    const text = Array(10).fill(line).join("\n"); // 409 chars
    const chunks = splitMessage(text, 100);

    assert.ok(chunks.length > 1);
    for (const chunk of chunks) assert.ok(chunk.length <= 100);
    assert.ok(chunks[0].includes("\n"));
    assert.equal(chunks.join("\n"), text);
});

test("text without any break point is cut at the limit", () => {
    const chunks = splitMessage("x".repeat(250), 100);
    assert.deepEqual(chunks.map((c) => c.length), [100, 100, 50]);
});
