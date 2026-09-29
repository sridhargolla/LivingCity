"use client";

// Memory Panel — makes Hindsight VISIBLE: recent recall/retain operations,
// memory bank stats, and the retained experiences ("what has the city learned").

import { useEffect, useState } from "react";
import { api } from "@/lib/city-api";
import { shortDate, shortTime, timeAgo } from "@/lib/city-format";

interface MemoryPanelProps {
  refreshTick: number;
  hindsightAvailable: boolean | null;
  onSelectEvent: (id: string) => void;
}

export function MemoryPanel({ refreshTick, hindsightAvailable, onSelectEvent }: MemoryPanelProps) {
  const [stats, setStats] = useState<Awaited<ReturnType<typeof api.memoryStats>>["cityMemory"] | null>(null);
  const [ops, setOps] = useState<Awaited<ReturnType<typeof api.memoryOperations>>["operations"]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([api.memoryStats(), api.memoryOperations(14)])
      .then(([s, o]) => {
        if (!alive) return;
        setStats(s.cityMemory);
        setOps(o.operations);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [refreshTick]);

  return (
    <section className="flex min-h-0 flex-col rounded-lg border border-[#1c2942] bg-[#0a101c]">
      <div className="flex items-center justify-between border-b border-[#1c2942] px-4 py-2.5">
        <h2 className="text-xs font-bold uppercase tracking-[0.22em] text-slate-300">🧠 City Memory · Hindsight</h2>
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-[10px] uppercase tracking-wider text-slate-500 hover:text-cyan-300"
          aria-expanded={open}
        >
          {open ? "collapse" : "expand"}
        </button>
      </div>

      <div className="px-4 py-3">
        {!stats ? (
          <p className="text-[11px] text-slate-500">Loading memory state…</p>
        ) : stats.hindsightAvailable ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="Experiences" value={stats.bankMemoryCount ?? stats.retains} accent="text-cyan-300" />
            <Metric label="Retains" value={stats.retains} accent="text-emerald-300" />
            <Metric label="Recalls" value={stats.recalls} accent="text-amber-300" />
            <Metric label="Patterns" value={stats.patternsDiscovered} accent="text-purple-300" />
          </div>
        ) : (
          <div className="rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
            <p className="text-[11px] font-medium text-amber-300">Hindsight memory temporarily unavailable.</p>
            <p className="mt-1 text-[10px] text-amber-200/60">
              Ingestion and display continue in degraded mode. No memory will be recalled or stored until it returns.
            </p>
          </div>
        )}
        {stats?.lastMemoryUpdate && (
          <p className="mt-2 text-[10px] text-slate-500">
            Last memory update: {shortDate(stats.lastMemoryUpdate)} {shortTime(stats.lastMemoryUpdate)} IST ·{" "}
            {timeAgo(stats.lastMemoryUpdate)} · bank <span className="text-slate-400">{stats.bankId}</span>
          </p>
        )}
      </div>

      {open && (
        <div className="lc-scroll max-h-72 overflow-y-auto border-t border-[#1c2942] px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Memory operations log</p>
          <ul className="mt-2 space-y-1">
            {ops.length === 0 && <li className="text-[11px] text-slate-500">No memory operations yet.</li>}
            {ops.map((o) => (
              <li key={o.id} className="flex items-start gap-2 rounded border border-[#141d31] bg-[#0d1526] px-2.5 py-1.5">
                <span
                  className={`mt-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider ${
                    o.operation === "RETAIN"
                      ? "bg-emerald-500/10 text-emerald-300"
                      : o.operation === "RECALL"
                        ? "bg-amber-500/10 text-amber-300"
                        : "bg-cyan-500/10 text-cyan-300"
                  }`}
                >
                  {o.operation}
                </span>
                <span className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${o.status === "SUCCESS" ? "bg-emerald-400" : o.status === "FAILED" ? "bg-rose-400" : "bg-slate-500"}`} />
                <button
                  className={`min-w-0 flex-1 text-left text-[11px] leading-snug ${o.eventId ? "text-slate-300 hover:text-cyan-300" : "text-slate-400"}`}
                  onClick={() => o.eventId && onSelectEvent(o.eventId)}
                  disabled={!o.eventId}
                >
                  <span className="line-clamp-2">{o.query || "(no query)"}</span>
                </button>
                <span className="shrink-0 text-[9px] text-slate-600">{timeAgo(o.createdAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value, accent }: { label: string; value: number | null; accent: string }) {
  return (
    <div className="rounded border border-[#141d31] bg-[#0d1526] px-2.5 py-2">
      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className={`text-xl font-bold leading-tight ${accent}`}>{value ?? "–"}</p>
    </div>
  );
}
