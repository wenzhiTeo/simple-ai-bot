/**
 * Download a URL into a Buffer, with timeout and retries.
 * `headers` lets an adapter pass auth (WhatsApp media needs a bearer token).
 */
export async function downloadBuffer(url, { timeout = 15000, retries = 3, headers } = {}) {
    let lastError;
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            const response = await fetch(url, { headers, signal: AbortSignal.timeout(timeout) });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return Buffer.from(await response.arrayBuffer());
        } catch (error) {
            lastError = error;
            if (attempt < retries - 1) {
                await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
            }
        }
    }
    throw lastError;
}
