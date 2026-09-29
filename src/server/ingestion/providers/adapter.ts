// LIVING CITY — Feed adapter interface + resilience helpers.
// Adapters fetch REAL data from verifiable sources. Nothing is fabricated:
// if a source fails or is unavailable the adapter returns a failure result and
// the feed health panel shows it honestly.

export interface FetchResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  durationMs: number;
}

export async function fetchWithResilience<T>(
  feedId: string,
  url: string,
  parse: (json: unknown) => T,
  opts: { timeoutMs?: number; retries?: number; headers?: Record<string, string> } = {}
): Promise<FetchResult<T>> {
  const timeoutMs = opts.timeoutMs ?? 10000;
  const retries = opts.retries ?? 1;
  const started = Date.now();
  let lastError = "";

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "LivingCity/0.1 (city operations memory demo)", ...opts.headers },
        cache: "no-store",
      });
      clearTimeout(timer);
      if (!res.ok) {
        lastError = `HTTP ${res.status} from ${new URL(url).host}`;
        if (res.status >= 400 && res.status < 500 && res.status !== 429) {
          // Client errors won't improve on retry — but 429 might.
          if (res.status !== 429) break;
        }
      } else {
        const json = await res.json();
        return { ok: true, data: parse(json), durationMs: Date.now() - started };
      }
    } catch (e) {
      clearTimeout(timer);
      lastError = e instanceof Error ? (e.name === "AbortError" ? `timeout after ${timeoutMs}ms` : e.message) : String(e);
    }
    if (attempt < retries) {
      await sleep(500 * 2 ** attempt); // backoff
    }
  }
  return { ok: false, error: lastError, durationMs: Date.now() - started };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
