// LIVING CITY — real-time SSE hook (no polling; server pushes, UI listens).
"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface RealtimePayload {
  event: string;
  data: Record<string, unknown>;
  ts: string;
}

export function useRealtime(onMessage?: (p: RealtimePayload) => void) {
  const [connected, setConnected] = useState(false);
  const [lastPayload, setLastPayload] = useState<RealtimePayload | null>(null);
  const [feed, setFeed] = useState<RealtimePayload[]>([]);
  const cbRef = useRef(onMessage);
  useEffect(() => {
    cbRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    const es = new EventSource("/api/events/stream");

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    const handler = (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data) as RealtimePayload;
        setLastPayload(payload);
        setFeed((f) => [...f.slice(-99), payload]);
        cbRef.current?.(payload);
      } catch {
        // ignore malformed frames
      }
    };

    for (const name of [
      "event.created",
      "event.updated",
      "analysis.started",
      "memory.recalled",
      "analysis.completed",
      "memory.retained",
      "event.relationship.created",
      "feed.status_changed",
      "outcome.recorded",
    ]) {
      es.addEventListener(name, handler);
    }

    return () => {
      es.close();
      setConnected(false);
    };
  }, []);

  const clearFeed = useCallback(() => setFeed([]), []);
  return { connected, lastPayload, feed, clearFeed };
}
