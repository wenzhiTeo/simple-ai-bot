import test from "node:test";
import assert from "node:assert/strict";
import {
    extractPeriod, formatBill, formatCents, mergeItems, parseAmount, parseBillCommand, parseItems, removeItem, shareOf,
} from "../src/skills/bills/calc.js";

const SEPT = new Date(2026, 8, 20);

test("the agreed example: Wi-Fi 100, 水 6.50, 电 25.6 split by 2", () => {
    const command = parseBillCommand("水电费 9月 wifi 100 水 6.50 电 25.6", SEPT);
    const { text, totalCents } = formatBill({ ...command, people: 2 });

    assert.equal(text, [
        "水电费",
        "2026 年 9 月",
        "Wi-Fi = 100.00 / 2 = 50.00",
        "水费 = 6.50 / 2 = 3.25",
        "电费 = 25.60 / 2 = 12.80",
        "总计 RM66.05",
    ].join("\n"));
    assert.equal(totalCents, 6605);
});

test("amounts are parsed exactly into cents", () => {
    assert.equal(parseAmount("25.6"), 2560);
    assert.equal(parseAmount("RM1,234.50"), 123450);
    assert.equal(parseAmount("0.1"), 10);
    assert.equal(parseAmount("7"), 700);
    for (const bad of ["1.234", "abc", "", "-5", "1.2.3"]) assert.equal(parseAmount(bad), null, bad);
});

test("shares round half up and totals add the rounded shares", () => {
    assert.equal(shareOf(655, 2), 328);
    assert.equal(shareOf(1000, 3), 333);
    assert.equal(formatCents(5), "0.05");
    const { text, totalCents } = formatBill({ period: { year: 2026, month: 1 }, items: [{ name: "水费", cents: 655 }], people: 2 });
    assert.equal(totalCents, 328);
    assert.match(text, /水费 = 6\.55 \/ 2 = 3\.28/);
});

test("month formats, and a future month without a year means last year", () => {
    const jan = new Date(2027, 0, 5);
    assert.deepEqual(extractPeriod("2026年9月", jan).period, { year: 2026, month: 9 });
    assert.deepEqual(extractPeriod("2026-09", jan).period, { year: 2026, month: 9 });
    assert.deepEqual(extractPeriod("12月", jan).period, { year: 2026, month: 12 });
    assert.deepEqual(extractPeriod("1月", jan).period, { year: 2027, month: 1 });
    assert.equal(extractPeriod("13月", jan).period, null);
    assert.equal(extractPeriod("wifi 100", jan).period, null);
});

test("item names: aliases, separators, RM prefix and unknown names", () => {
    const { items, complete } = parseItems("WiFi=100 水:6.5 TNB RM25.60 煤气 12");
    assert.equal(complete, true);
    assert.deepEqual(items, [
        { name: "Wi-Fi", cents: 10000 },
        { name: "水费", cents: 650 },
        { name: "电费", cents: 2560 },
        { name: "煤气", cents: 1200 },
    ]);
});

test("ordinary sentences are not mistaken for complete item lists", () => {
    assert.equal(parseItems("我今天花了 25 块").complete, false);
    assert.equal(parseItems("你好").complete, false);
    assert.equal(parseItems("电 25.6").complete, true);
});

test("non-bill messages are not commands; unknown leftovers are reported", () => {
    assert.equal(parseBillCommand("你好", SEPT), null);
    const command = parseBillCommand("水电费 wifi 100 谢谢", SEPT);
    assert.equal(command.period, null);
    assert.equal(command.items.length, 1);
    assert.equal(command.leftover, "谢谢");
});

test("merge replaces by name, remove accepts aliases", () => {
    const items = [{ name: "Wi-Fi", cents: 10000 }, { name: "电费", cents: 2560 }];
    assert.deepEqual(mergeItems(items, [{ name: "电费", cents: 3000 }, { name: "水费", cents: 650 }]), [
        { name: "Wi-Fi", cents: 10000 }, { name: "电费", cents: 3000 }, { name: "水费", cents: 650 },
    ]);
    assert.deepEqual(removeItem(items, "电"), [{ name: "Wi-Fi", cents: 10000 }]);
});
