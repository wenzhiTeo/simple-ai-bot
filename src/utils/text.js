/**
 * Split text into chunks of at most `max` characters, preferring to break at a
 * newline, then at a space, and only cutting mid-word as a last resort.
 */
export function splitMessage(text, max = 2000) {
    const chunks = [];
    let rest = (text ?? "").trim();

    while (rest.length > max) {
        let cut = rest.lastIndexOf("\n", max);
        if (cut < max / 2) cut = rest.lastIndexOf(" ", max);
        if (cut < max / 2) cut = max;
        chunks.push(rest.slice(0, cut).trimEnd());
        rest = rest.slice(cut).trimStart();
    }

    if (rest) chunks.push(rest);
    return chunks;
}
