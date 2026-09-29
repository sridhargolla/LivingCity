"use client";

// LIVING CITY — Memories: the Hindsight long-term city memory, as its own page.
// Past experiences, retention audit, memory graph (relationships come only from
// real stored events), timeline, and recurring patterns. Search across memory.

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { api } from "@/lib/city-api";
import { useAppStore } from "@/lib/store";
import { usePoll } from "@/hooks/usePoll";
import { timeAgo } from "@/lib/city-format";
import { MemoryGraph } from "@/components/city/MemoryGraph";
import { MemoryTimeline } from "@/components/city/MemoryTimeline";
import { MemoryPanel } from "@/components/city/MemoryPanel";
import { PageHeader, Panel, LoadingBlock, ErrorBlock, EmptyHint } from "@/components/pages/shared";

const RELATION_CLS: Record<string, string> = {
  RECURRING_PATTERN: "text-purple-300 border-purple-500/40",
  SIMILAR: "text-cyan-300 border-cyan-500/40",
  RELATED: "text-emerald-300 border-emerald-500/40",
  POSSIBLE_ESCALATION: "text-amber-300 border-amber-500/40",
};

export function MemoriesPage() {
  const cityId = useAppStore((s) => s.cityId);
  const setPage = useAppStore((s) => s.setPage);
  const selectEvent = useAppStore((s) => s.selectEvent);

  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQuery(searchInput.trim() || null), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const stats = usePoll(() => api.memoryStats(), 120_000, []);
  const memories = usePoll(() => api.memories({ cityId, q: query ?? undefined, limit: 40 }), 90_000, [cityId, query]);
  const patterns = usePoll(() => api.patterns(), 120_000, []);

  const cm = stats.data?.cityMemory;
  const openEvent = useCallback(
    (id: string) => {
      selectEvent(id);
      setPage("live-events");
    },
    [selectEvent, setPage]
  );

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title="Memories"
        subtitle="What the city remembers — Hindsight long-term experience, distilled from real events"
        right={
          <button
            onClick={() => {
              stats.refresh();
              memories.refresh();
              patterns.refresh();
            }}
            className="flex items-center gap-1.5 rounded border border-[#1c2942] px-2.5 py-1.5 text-[11px] text-slate-300 transition-colors hover:bg-white/5"
            aria-label="Refresh memories"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Refresh
          </button>
        }
      />

      {/* hindsight status strip */}
      {cm ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#1c2942] bg-[#0a101c] px-4 py-3 text-[11px]">
          <span className={`font-bold uppercase tracking-wider ${cm.hindsightAvailable ? "text-emerald-300" : "text-amber-300"}`}>
            {cm.hindsightAvailable ? "🟢 HINDSIGHT CONNECTED" : "🟡 HINDSIGHT UNAVAILABLE — HONEST DEGRADED MODE"}
          </span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400">Bank: {cm.bankId}</span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400">{cm.bankMemoryCount ?? "—"} memory units</span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400">{cm.retains} retains · {cm.recalls} recalls · {cm.patternsDiscovered} patterns</span>
          {cm.lastMemoryUpdate && (
            <>
              <span className="text-slate-500">|</span>
              <span className="text-slate-500">last update {timeAgo(cm.lastMemoryUpdate)}</span>
            </>
          )}
        </div>
      ) : (
        <LoadingBlock label="Loading memory system status…" />
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex min-w-0 flex-col gap-4">
          {/* search + memory list */}
          <Panel title="City experiences" right={<span className="text-[10px] text-slate-500">{memories.data ? `${memories.data.total} found` : ""}</span>}>
            <div className="relative mb-3">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" aria-hidden />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search city memory (e.g. rain, flooding, AQI)…"
                aria-label="Search city memory"
                className="w-full rounded border border-[#1c2942] bg-[#070d18] py-2 pl-8 pr-3 text-[12px] text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
              />
            </div>

            {memories.loading && !memories.data ? (
              <LoadingBlock label="Searching memory…" />
            ) : memories.error ? (
              <ErrorBlock message={memories.error} />
            ) : memories.data && memories.data.items.length > 0 ? (
              <ul className="flex max-h-[480px] flex-col gap-2 overflow-y-auto pr-1 [scrollbar-color:#1c2942_transparent] [scrollbar-width:thin]">
                {memories.data.items.map((m) => (
                  <li key={m.id} className="rounded border border-[#1c2942] bg-[#070d18] px-3 py-2.5">
                    <p className="text-[12px] leading-relaxed text-slate-200">{m.text}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                      <span className="rounded border border-[#1c2942] px-1.5 py-0.5 uppercase tracking-wider">
                        {m.storage === "hindsight" ? "HINDSIGHT" : "RETAIN-LOG"}
                      </span>
                      {m.occurredStart && <span>occurred {timeAgo(m.occurredStart)}</span>}
                      {m.tags.slice(0, 3).map((t) => (
                        <span key={t} className="rounded bg-white/5 px-1.5 py-0.5 text-slate-400">
                          {t}
                        </span>
                      ))}
                      <span className="ml-auto">{timeAgo(m.createdAt)}</span>
                      {m.eventId && (
                        <button
                          onClick={() => openEvent(m.eventId!)}
                          className="rounded border border-[#1c2942] px-2 py-0.5 text-[10px] text-cyan-300 hover:bg-white/5"
                        >
                          View related event
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyHint>
                {memories.data?.hindsight.available === false
                  ? `Hindsight is unreachable (${memories.data.hindsight.error ?? "unknown error"}) — showing retain-log entries only. Nothing is invented.`
                  : query
                    ? "No memories match this search yet."
                    : "No memories retained yet — experience is distilled as real events resolve."}
              </EmptyHint>
            )}
          </Panel>

          {/* memory graph — edges only from stored relationships */}
          <Panel title="Memory graph" bodyClassName="p-0" id="lc-memory-graph">
            <div className="max-h-[460px] overflow-y-auto [scrollbar-color:#1c2942_transparent] [scrollbar-width:thin]">
              <MemoryGraph onSelectEvent={openEvent} />
            </div>
          </Panel>

          {/* timeline */}
          <Panel title="Event timeline" bodyClassName="p-0">
            <div className="max-h-[420px] overflow-y-auto [scrollbar-color:#1c2942_transparent] [scrollbar-width:thin]">
              <MemoryTimeline refreshTick={0} onSelectEvent={openEvent} selectedId={null} />
            </div>
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {/* retention audit */}
          <Panel title="Retention audit" bodyClassName="p-0">
            <div className="max-h-[380px] overflow-y-auto [scrollbar-color:#1c2942_transparent] [scrollbar-width:thin]">
              <MemoryPanel refreshTick={0} hindsightAvailable={cm?.hindsightAvailable ?? null} onSelectEvent={openEvent} />
            </div>
          </Panel>

          {/* recurring patterns */}
          <Panel title="Recurring patterns" right={<span className="text-[10px] text-slate-500">from real event relationships</span>}>
            {patterns.loading && !patterns.data ? (
              <LoadingBlock label="Loading patterns…" />
            ) : patterns.error ? (
              <ErrorBlock message={patterns.error} />
            ) : patterns.data && patterns.data.patterns.length > 0 ? (
              <ul className="flex max-h-[420px] flex-col gap-2 overflow-y-auto pr-1 [scrollbar-color:#1c2942_transparent] [scrollbar-width:thin]">
                {patterns.data.patterns.map((p) => (
                  <li key={p.id} className="rounded border border-[#1c2942] bg-[#070d18] px-3 py-2.5 text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold tracking-wider ${RELATION_CLS[p.relation] ?? "text-slate-300 border-[#1c2942]"}`}>
                        {p.relation.replace(/_/g, " ")}
                      </span>
                      <span className="text-slate-500">confidence {(p.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <p className="mt-1.5 leading-relaxed text-slate-300">{p.explanation}</p>
                    <div className="mt-1.5 flex flex-col gap-1 text-[10px] text-slate-500">
                      <button onClick={() => openEvent(p.from.id)} className="truncate text-left hover:text-cyan-300">
                        ← {p.from.title} <span className="text-slate-600">({timeAgo(p.from.observedAt)})</span>
                      </button>
                      <button onClick={() => openEvent(p.to.id)} className="truncate text-left hover:text-cyan-300">
                        → {p.to.title} <span className="text-slate-600">({timeAgo(p.to.observedAt)})</span>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyHint>No recurring patterns discovered yet — they emerge as similar real events repeat over time.</EmptyHint>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
