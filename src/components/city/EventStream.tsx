"use client";

import { useEffect, useRef } from "react";
import { EVENT_ICONS, ORIGIN_META, SEVERITY_COLORS, shortTime, timeAgo } from "@/lib/city-format";
import type { PublicEvent } from "@/lib/city-api";

interface EventStreamProps {
  events: PublicEvent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  newEventIds: Set<string>;
}

export function EventStream({ events, selectedId, onSelect, newEventIds }: EventStreamProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // keep newest visible unless the operator scrolled up to read history
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [events.length]);

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-lg border border-[#1c2942] bg-[#0a101c]">
      <div className="flex items-center justify-between border-b border-[#1c2942] px-4 py-2.5">
        <h2 className="text-xs font-bold uppercase tracking-[0.22em] text-slate-300">Live Event Stream</h2>
        <span className="text-[10px] uppercase tracking-wider text-slate-500">
          {events.length} events · SSE
        </span>
      </div>
      <div ref={scrollRef} className="lc-scroll min-h-0 flex-1 overflow-y-auto" style={{ maxHeight: 420 }}>
        {events.length === 0 && (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
            <span className="text-2xl opacity-40">📡</span>
            <p className="text-xs text-slate-500">Waiting for city signals…</p>
            <p className="text-[10px] text-slate-600">The ingestion poller runs every few minutes.</p>
          </div>
        )}
        <ul className="divide-y divide-[#141d31]">
          {events.map((e) => {
            const isNew = newEventIds.has(e.id);
            return (
              <li key={e.id}>
                <button
                  onClick={() => onSelect(e.id)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[#0d1526] ${
                    selectedId === e.id ? "bg-[#0d1526]" : ""
                  } ${isNew ? "lc-row-enter" : ""}`}
                  aria-current={selectedId === e.id}
                >
                  <span className="w-10 shrink-0 font-mono text-[11px] text-slate-500">
                    {shortTime(e.observedAt)}
                  </span>
                  <span className="shrink-0 text-base" aria-hidden>
                    {EVENT_ICONS[e.eventType] ?? "📍"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-slate-200">{e.title}</span>
                    <span className="block truncate text-[11px] text-slate-500">
                      {e.locationName} · {timeAgo(e.observedAt)} · {e.source}
                    </span>
                  </span>
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: SEVERITY_COLORS[e.severity] ?? "#64748b" }}
                    title={`Severity: ${e.severity}`}
                    aria-label={`Severity ${e.severity}`}
                  />
                  <span
                    className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-bold tracking-wider ${
                      ORIGIN_META[e.dataOrigin]?.badge ?? ""
                    }`}
                  >
                    {ORIGIN_META[e.dataOrigin]?.label ?? e.dataOrigin}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
