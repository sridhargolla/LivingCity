// GET /api/events/stream — Server-Sent Events: real-time pipeline feed.
import { subscribe, recentEvents, type RealtimePayload } from "@/server/realtime/eventBus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (payload: RealtimePayload) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${payload.event}\ndata: ${JSON.stringify(payload)}\n\n`));
        } catch {
          closed = true;
        }
      };

      // replay recent history so a fresh subscriber sees context immediately
      for (const p of recentEvents(15)) send(p);

      const unsubscribe = subscribe(send);
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: heartbeat\ndata: ${JSON.stringify({ ts: new Date().toISOString() })}\n\n`));
        } catch {
          closed = true;
        }
      }, 20000);

      const cleanup = () => {
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {}
      };
      // @ts-expect-error signal available at runtime
      (controller as unknown as { signal?: AbortSignal }).signal?.addEventListener?.("abort", cleanup);
      // Next.js aborts the request via request.signal; also hard-stop after 30 min
      setTimeout(cleanup, 30 * 60 * 1000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
