"use client";

// Memory Timeline — PAST experience column vs CURRENT column.
// Shows the operator that the city has accumulated experience over time.

import { useEffect, useState } from "react";
import { api, type PublicEvent } from "@/lib/city-api";
import { EVENT_ICONS, ORIGIN_META, SEVERITY_COLORS, shortDate, shortTime, timeAgo } from "@/lib/city-format";

export function MemoryTimeline({
  refreshTick,
  onSelectEvent,
  selectedId,
}: {
  refreshTick: number;
  onSelectEvent: (id: string) => void;
  selectedId: string | null;
}) {
  const [past, setPast] = useState<PublicEvent[]>([]);
  const [current, setCurrent] = useState<PublicEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      try {
        const t = await api.timeline(14);
        if (!alive) return;
        setPast(t.timeline.past.slice(0, 40));
        setCurrent(t.timeline.current.slice(0, 12));
      } catch {
        // keep previous data on failure
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [refreshTick]);

  return (
    <section className="rounded-lg border border-[#1c2942] bg-[#0a101c]">
      <div className="flex items-center justify-between border-b border-[#1c2942] px-4 py-2.5">
        <h2 className="text-xs font-bold uppercase tracking-[0.22em] text-slate-300">Memory Timeline</h2>
        <span className="text-[10px] uppercase tracking-wider text-slate-500">last 14 days</span>
      </div>
      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400" />
        </div>
      ) : (
        <div className="grid gap-0 md:grid-cols-2">
          <div className="border-b border-[#1c2942] px-4 py-3 md:border-b-0 md:border-r">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
              Past — accumulated experience ({past.length})
            </p>
            <ul className="lc-scroll mt-2 max-h-56 space-y-1 overflow-y-auto pr-1">
              {past.length === 0 && <li className="py-4 text-[11px] text-slate-500">No past events in window.</li>}
              {past.map((e, i) => (
                <TimelineRow key={e.id} e={e} onSelect={onSelectEvent} selected={selectedId === e.id} last={i === past.length - 1} />
              ))}
            </ul>
          </div>
          <div className="px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300">
              Current — the last hour ({current.length})
            </p>
            <ul className="lc-scroll mt-2 max-h-56 space-y-1 overflow-y-auto pr-1">
              {current.length === 0 && <li className="py-4 text-[11px] text-slate-500">Nothing new this hour.</li>}
              {current.map((e, i) => (
                <TimelineRow key={e.id} e={e} onSelect={onSelectEvent} selected={selectedId === e.id} last={i === current.length - 1} />
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

function TimelineRow({
  e,
  onSelect,
  selected,
  last,
}: {
  e: PublicEvent;
  onSelect: (id: string) => void;
  selected: boolean;
  last: boolean;
}) {
  return (
    <li className="relative pl-5">
      {!last && <span className="absolute left-[7px] top-4 h-full w-px bg-[#1c2942]" aria-hidden />}
      <span
        className="absolute left-[4px] top-[9px] h-1.5 w-1.5 rounded-full"
        style={{ background: SEVERITY_COLORS[e.severity] ?? "#64748b" }}
        aria-hidden
      />
      <button
        onClick={() => onSelect(e.id)}
        className={`flex w-full items-center gap-2 rounded px-1.5 py-1 text-left hover:bg-[#0d1526] ${selected ? "bg-[#0d1526]" : ""}`}
      >
        <span aria-hidden>{EVENT_ICONS[e.eventType] ?? "📍"}</span>
        <span className="min-w-0 flex-1 truncate text-[11px] text-slate-300">{e.title}</span>
        <span className="shrink-0 font-mono text-[9px] text-slate-600">
          {shortDate(e.observedAt)} {shortTime(e.observedAt)}
        </span>
        <span className={`shrink-0 rounded border px-1 py-0.5 text-[8px] font-bold ${ORIGIN_META[e.dataOrigin]?.badge}`}>
          {ORIGIN_META[e.dataOrigin]?.label[0]}
        </span>
      </button>
    </li>
  );
}
