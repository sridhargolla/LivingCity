// LIVING CITY — Next.js instrumentation: starts the feed scheduler once per server process.
// Uses a plain setInterval poller (local-memory caching + bounded concurrency).

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Sandbox networks sometimes have no IPv6 egress; Node's undici fetch can pick the
  // AAAA address and hang (ETIMEDOUT). Force an IPv4-first global dispatcher so all
  // server-side fetches (feeds + Hindsight) are resilient.
  try {
    const { Agent, setGlobalDispatcher } = await import("undici");
    setGlobalDispatcher(new Agent({ connect: { family: 4 } }));
  } catch {
    // non-fatal — fall back to default dispatcher
  }

  if (process.env.FEED_POLLING_DISABLED === "true") {
    console.log("[living-city] feed polling disabled by env");
    return;
  }

  const globalForSched = globalThis as unknown as { __livingCityScheduler?: NodeJS.Timeout };
  if (globalForSched.__livingCityScheduler) return;

  const { runAllFeeds } = await import("@/server/ingestion/runFeeds");
  const intervalMs = Number(process.env.FEED_POLL_INTERVAL_MS ?? "300000");

  // initial run shortly after boot (let the server settle first)
  setTimeout(() => {
    runAllFeeds().catch((e) => console.error("[living-city] initial feed run failed", e));
  }, 4000);

  globalForSched.__livingCityScheduler = setInterval(() => {
    runAllFeeds().catch((e) => console.error("[living-city] scheduled feed run failed", e));
  }, intervalMs);

  console.log(`[living-city] feed scheduler started (interval ${intervalMs}ms)`);
}
