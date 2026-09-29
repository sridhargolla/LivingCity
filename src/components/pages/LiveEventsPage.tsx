"use client";

// LIVING CITY — Live Events: every real event ingested from verified sources,
// with honest category filters (only categories backed by configured providers
// carry live data) and the full detail panel with memory recall + evidence.

import { useMemo, useState } from "react";
import { api } from "@/lib/city-api";
import { useAppStore } from "@/lib/store";
import { usePoll } from "@/hooks/usePoll";
import { EventStream } from "@/components/city/EventStream";
import { EventDetailPanel } from "@/components/city/EventDetailPanel";
import { EvidenceDialog } from "@/components/city/EvidenceDialog";
import { PageHeader, Panel, LoadingBlock, EmptyHint } from "@/components/pages/shared";
import { cn } from "@/lib/utils";

type Category = "ALL" | "WEATHER" | "AIR_QUALITY" | "OTHER";

function categoryOf(eventType: string): Exclude<Category, "ALL"> {
  if (eventType.startsWith("WEATHER") || eventType === "HEAT" || eventType === "STORM") return "WEATHER";
  if (eventType === "AIR_QUALITY") return "AIR_QUALITY";
  return "OTHER";
}

const CATEGORY_LABEL: Record<Category, string> = {
  ALL: "All",
  WEATHER: "🌧 Weather",
  AIR_QUALITY: "🌫 Air quality",
  OTHER: "📍 Other incidents",
};

export function LiveEventsPage() {
  const cityId = useAppStore((s) => s.cityId);
  const selectedEventId = useAppStore((s) => s.selectedEventId);
  const selectEvent = useAppStore((s) => s.selectEvent);

  const [category, setCategory] = useState<Category>("ALL");
  const [origin, setOrigin] = useState<"ALL" | "LIVE">("ALL");
  const [status, setStatus] = useState<"ALL" | "ACTIVE">("ALL");
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceEventId, setEvidenceEventId] = useState<string | null>(null);

  const events = usePoll(() => api.events({ cityId, limit: 120 }), 30_000, [cityId]);
  const allEvents = events.data?.events ?? [];

  const counts = useMemo(() => {
    const c: Record<Category, number> = { ALL: allEvents.length, WEATHER: 0, AIR_QUALITY: 0, OTHER: 0 };
    for (const e of allEvents) c[categoryOf(e.eventType)] += 1;
    return c;
  }, [allEvents]);

  const filtered = useMemo(() => {
    let list = allEvents;
    if (category !== "ALL") list = list.filter((e) => categoryOf(e.eventType) === category);
    if (origin === "LIVE") list = list.filter((e) => e.dataOrigin === "LIVE");
    if (status === "ACTIVE") list = list.filter((e) => e.status === "ACTIVE" || e.status === "DEVELOPING");
    return list;
  }, [allEvents, category, origin, status]);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title="Live Events"
        subtitle="Real events from verified sources — weather, air quality and operator reports. No synthetic incidents."
        right={
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded border border-[#1c2942]" role="group" aria-label="Origin filter">
              {(["ALL", "LIVE"] as const).map((o) => (
                <button
                  key={o}
                  onClick={() => setOrigin(o)}
                  aria-pressed={origin === o}
                  className={cn(
                    "px-2.5 py-1.5 text-[10px] font-bold tracking-wider transition-colors",
                    origin === o ? "bg-cyan-500/15 text-cyan-300" : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  {o === "LIVE" ? "LIVE ONLY" : "ALL"}
                </button>
              ))}
            </div>
            <div className="flex overflow-hidden rounded border border-[#1c2942]" role="group" aria-label="Status filter">
              {(["ALL", "ACTIVE"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  aria-pressed={status === s}
                  className={cn(
                    "px-2.5 py-1.5 text-[10px] font-bold tracking-wider transition-colors",
                    status === s ? "bg-rose-500/15 text-rose-300" : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  {s === "ACTIVE" ? "UNRESOLVED" : "ANY STATUS"}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {/* category filter with honest counts */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Category filter">
        {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            aria-pressed={category === c}
            className={cn(
              "rounded border px-3 py-1.5 text-[11px] font-semibold transition-colors",
              category === c
                ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
                : "border-[#1c2942] bg-[#0a101c] text-slate-400 hover:bg-white/5"
            )}
          >
            {CATEGORY_LABEL[c]} <span className="ml-1 text-[10px] text-slate-500">{counts[c]}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Panel title={`Events (${filtered.length})`} bodyClassName="p-0">
          {events.loading && allEvents.length === 0 ? (
            <div className="p-4">
              <LoadingBlock label="Loading events…" />
            </div>
          ) : filtered.length > 0 ? (
            <div className="max-h-[calc(100vh-330px)] min-h-[320px] overflow-y-auto [scrollbar-color:#1c2942_transparent] [scrollbar-width:thin]">
              <EventStream events={filtered} selectedId={selectedEventId} onSelect={selectEvent} newEventIds={new Set<string>()} />
            </div>
          ) : (
            <div className="p-4">
              <EmptyHint>
                No events match these filters. This system only shows events ingested from verified live sources — it
                never generates placeholder incidents.
              </EmptyHint>
            </div>
          )}
        </Panel>

        <div className="flex min-w-0 flex-col">
          {selectedEventId ? (
            <EventDetailPanel
              eventId={selectedEventId}
              events={allEvents}
              onSelect={selectEvent}
              onClose={() => selectEvent(null)}
              refreshTick={0}
              onRunWhatIf={() => undefined}
              onShowEvidence={(id) => {
                setEvidenceEventId(id);
                setEvidenceOpen(true);
              }}
            />
          ) : (
            <Panel title="Event details">
              <p className="py-6 text-[11px] leading-relaxed text-slate-500">
                Select an event to see its full record: source, evidence, Hindsight memory recall, agent assessment,
                human feedback and outcomes.
              </p>
            </Panel>
          )}
        </div>
      </div>

      <EvidenceDialog
        open={evidenceOpen}
        eventId={evidenceEventId}
        cityId={cityId}
        onClose={() => {
          setEvidenceOpen(false);
          setEvidenceEventId(null);
        }}
        onViewEvent={(id) => {
          setEvidenceOpen(false);
          selectEvent(id);
        }}
        onFocusMap={(id) => {
          setEvidenceOpen(false);
          selectEvent(id);
        }}
      />
    </div>
  );
}
