/**
 * Pure bill logic: parsing, money maths and formatting. No I/O here.
 * All money is handled as integer cents so 0.1 + 0.2 problems cannot happen.
 */

export const BILL_KEYWORDS = ["水电费", "杂费"];

const CATEGORY_LABELS = { wifi: "Wi-Fi", water: "水费", electricity: "电费" };

const ALIASES = [
    [/^(wi-?fi|网络|网费|宽带|internet|unifi|maxis|time|celcom|digi)$/i, "wifi"],
    [/^(水|水费|water|air)$/i, "water"],
    [/^(电|电费|electric|electricity|elektrik|tnb)$/i, "electricity"],
];

/** "wifi" / "水" / "TNB" -> "Wi-Fi" / "水费" / "电费"; anything else is kept as typed. */
export function displayName(name, category) {
    if (CATEGORY_LABELS[category]) return CATEGORY_LABELS[category];
    const trimmed = String(name ?? "").trim();
    const match = ALIASES.find(([pattern]) => pattern.test(trimmed));
    return match ? CATEGORY_LABELS[match[1]] : trimmed;
}

/** "25.6" / "RM1,234.50" -> cents, or null when it is not a valid amount. */
export function parseAmount(raw) {
    const text = String(raw ?? "").replace(/^RM/i, "").replace(/,/g, "").trim();
    if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
    const [whole, fraction = ""] = text.split(".");
    return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

/** 6605 -> "66.05" */
export function formatCents(cents) {
    return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

/** One person's share, rounded half up to the cent (655 / 2 -> 328). */
export function shareOf(cents, people) {
    return Math.round(cents / people);
}

/** Current calendar month as { year, month }. */
export function currentPeriod(now = new Date()) {
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

/**
 * Find and remove a month in the text: "2026年9月", "2026-09", "2026/9" or "9月".
 * A month without a year that is still in the future means last year (typing "12月" in January).
 */
export function extractPeriod(text, now = new Date()) {
    const patterns = [
        { re: /(\d{4})\s*年\s*(\d{1,2})\s*月/, year: 1, month: 2 },
        { re: /(\d{4})[-/.](\d{1,2})(?!\d)/, year: 1, month: 2 },
        { re: /(?<![\d.])(\d{1,2})\s*月/, month: 1 },
    ];

    for (const { re, year, month } of patterns) {
        const match = text.match(re);
        if (!match) continue;
        const m = Number(match[month]);
        if (m < 1 || m > 12) continue;

        let y = year ? Number(match[year]) : now.getFullYear();
        if (!year && m > now.getMonth() + 1) y -= 1;
        return { period: { year: y, month: m }, rest: text.replace(match[0], " ") };
    }
    return { period: null, rest: text };
}

/**
 * "wifi 100 水 6.50 电=25.6" -> [{ name: "Wi-Fi", cents: 10000 }, …]
 * `complete` is false when some text was left over that is not an item,
 * so "我今天花了 25 块" is not mistaken for a bill correction.
 */
export function parseItems(text) {
    const itemPattern = /([^\d\s=:：,，;；+]+?)\s*[=:：]?\s*(?:RM\s*)?(\d[\d,]*(?:\.\d{1,2})?)(?![\d.])/gi;
    const items = [];
    for (const [, rawName, rawAmount] of text.matchAll(itemPattern)) {
        const cents = parseAmount(rawAmount);
        if (cents === null || /^rm$/i.test(rawName)) continue;
        items.push({ name: displayName(rawName), cents });
    }
    const leftover = text.replace(itemPattern, "").replace(/[\s,，;；+]/g, "");
    return { items, complete: items.length > 0 && leftover === "", leftover };
}

/** "水电费 9月 wifi 100 水 6.5" -> { period, items, leftover }, or null when the message is not a bill command. */
export function parseBillCommand(text, now = new Date()) {
    const trimmed = (text ?? "").trim();
    const keyword = BILL_KEYWORDS.find((k) => trimmed.startsWith(k));
    if (!keyword) return null;

    const { period, rest } = extractPeriod(trimmed.slice(keyword.length), now);
    const { items, leftover } = parseItems(rest);
    return { period, items, leftover };
}

/** Add or replace items by name (case-insensitive). */
export function mergeItems(existing, incoming) {
    const merged = [...existing];
    for (const item of incoming) {
        const index = merged.findIndex((e) => e.name.toLowerCase() === item.name.toLowerCase());
        if (index >= 0) merged[index] = item;
        else merged.push(item);
    }
    return merged;
}

/** Remove the item whose name matches (aliases allowed: "电" removes "电费"). */
export function removeItem(items, name) {
    const target = displayName(name).toLowerCase();
    return items.filter((item) => item.name.toLowerCase() !== target);
}

/**
 * @returns {{ text: string, totalCents: number }}
 *
 * 水电费
 * 2026 年 9 月
 * Wi-Fi = 100.00 / 2 = 50.00
 * 总计 RM50.00
 */
export function formatBill({ period, items, people }) {
    let totalCents = 0;
    const lines = items.map((item) => {
        const share = shareOf(item.cents, people);
        totalCents += share;
        return `${item.name} = ${formatCents(item.cents)} / ${people} = ${formatCents(share)}`;
    });

    const text = [
        "水电费",
        `${period.year} 年 ${period.month} 月`,
        ...lines,
        `总计 RM${formatCents(totalCents)}`,
    ].join("\n");

    return { text, totalCents };
}
