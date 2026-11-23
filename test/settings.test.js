import test from "node:test";
import assert from "node:assert/strict";
import { GeminiService } from "../src/services/gemini.js";
import { createTestDb } from "./helpers.js";

const defaults = { model: "gemini-env", maxOutputTokens: 4096, historyLimit: 20 };

test("seedDefaults creates the row once and never overwrites admin edits", async () => {
    const { Setting } = await createTestDb();
    assert.equal(await Setting.current(), null);

    await Setting.seedDefaults(defaults);
    assert.deepEqual(await Setting.current(),
        { model: "gemini-env", temperature: 0.9, maxOutputTokens: 4096, historyLimit: 20 });

    await Setting.update({ model_name: "  gemini-admin  ", history_limit: 6 }, { where: { id: 1 }, individualHooks: true });
    await Setting.seedDefaults({ ...defaults, model: "gemini-env-changed" });
    const current = await Setting.current();
    assert.equal(current.model, "gemini-admin");
    assert.equal(current.historyLimit, 6);
    assert.equal(await Setting.count(), 1);
});

test("invalid values are rejected", async () => {
    const { Setting } = await createTestDb();
    await Setting.seedDefaults(defaults);
    const row = await Setting.findByPk(1);
    for (const bad of [{ temperature: 3 }, { temperature: -1 }, { max_output_tokens: 0 }, { history_limit: -1 }, { model_name: "" }]) {
        await assert.rejects(row.update(bad), { name: "SequelizeValidationError" }, JSON.stringify(bad));
        await row.reload();
    }
});

function fakeGemini(getSettings) {
    const service = new GeminiService({ apiKey: "x", model: "env-model", maxOutputTokens: 100, getSettings });
    const requests = [];
    service.client = { models: { generateContent: async (req) => { requests.push(req); return { text: "{}" }; } } };
    return { service, requests };
}

test("GeminiService uses the current settings on every request", async () => {
    let settings = { model: "admin-model", temperature: 0.2, maxOutputTokens: 50 };
    const { service, requests } = fakeGemini(async () => settings);

    await service.generate({ text: "hi" });
    assert.equal(requests[0].model, "admin-model");
    assert.equal(requests[0].config.temperature, 0.2);
    assert.equal(requests[0].config.maxOutputTokens, 50);

    settings = { model: "newer-model", temperature: 0, maxOutputTokens: 50 };
    await service.generate({ text: "hi" });
    assert.equal(requests[1].model, "newer-model");
    assert.equal(requests[1].config.temperature, 0);

    await service.extractJson({ text: "x", schema: {} });
    assert.equal(requests[2].model, "newer-model");
    assert.equal(requests[2].config.temperature, 0, "extraction stays deterministic");
});

test("GeminiService falls back to constructor values without settings", async () => {
    const { service, requests } = fakeGemini(async () => null);
    await service.generate({ text: "hi" });
    assert.equal(requests[0].model, "env-model");
    assert.equal(requests[0].config.temperature, 0.9);
    assert.equal(requests[0].config.maxOutputTokens, 100);
});
