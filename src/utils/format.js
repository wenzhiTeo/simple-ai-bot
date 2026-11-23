/**
 * Human-readable (Chinese) formatting for status output.
 * src/web/status.html has browser copies of these; keep the two in step.
 */

const MB = 1024 * 1024;

export function bytes(n) {
    if (n === null || n === undefined) return "—";
    if (n >= 1024 * MB) return (n / (1024 * MB)).toFixed(1) + " GB";
    if (n >= MB) return Math.round(n / MB) + " MB";
    return Math.round(n / 1024) + " KB";
}

export function duration(seconds) {
    const sec = Math.floor(seconds);
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (d) return `${d} 天 ${h} 小时`;
    if (h) return `${h} 小时 ${m} 分`;
    if (m) return `${m} 分钟`;
    return `${sec} 秒`;
}

/** "5 分钟前" for an ISO time / Date, "—" when missing. */
export function ago(time, now = Date.now()) {
    if (!time) return "—";
    const sec = (now - new Date(time).getTime()) / 1000;
    if (sec < 60) return "刚刚";
    return duration(sec) + "前";
}

export function num(n) {
    return (n ?? 0).toLocaleString("zh-CN");
}

export function platformName(name) {
    return { discord: "Discord", whatsapp: "WhatsApp" }[name] ?? name;
}
