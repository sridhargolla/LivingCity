"use client";

// LIVING CITY — Live City: the geographic real-time view. Consumes the same
// shared city data layer as every other page. Only verified events with real
// coordinates are plotted; metrics chips carry their honest status labels.

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { api, type PublicEvent } from "@/lib/city-api";
import { useAppStore } from "@/lib/store";
import { usePoll } from "@/hooks/usePoll";
import { EventStream } from "@/components/city/EventStream";
import { EventDetailPanel } from "@/components/city/EventDetailPanel";
import { EvidenceDialog } from "@/components/city/EvidenceDialog";
import { PageHeader, Panel, StatusPill, LoadingBlock } from "@/components/pages/shared";
import { cn } from "@/lib/utils";

// Leaflet touches `window` at module scope → client-only load.
const CityMap = dynamic(
  () => import("@/components/map/CityMap").then((m) => m.CityMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center rounded-lg border border-[#1c2942] bg-slate-950">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400" />
      </div>
    ),
  }
);

// Three.js heavy → client-only load. If it fails, 2D remains available.
const City3D = dynamic(
  () => import("@/components/map/City3D").then((m) => m.City3D),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center rounded-lg border border-[#1c2942] bg-slate-950">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-500/30 border-t-purple-400" />
      </div>
    ),
  }
);

export function LiveCityPage() {
  const cityId = useAppStore((s) => s.cityId);
  const cities = useAppStore((s) => s.cities);
  const selectedEventId = useAppStore((s) => s.selectedEventId);
  const selectEvent = useAppStore((s) => s.selectEvent);
  const focusEventId = useAppStore((s) => s.focusEventId);
  const focusTick = useAppStore((s) => s.focusTick);
  const clearFocus = useAppStore((s) => s.clearFocus);

  const [view, setView] = useState<"2D" | "3D">("2D");
  const [origin, setOrigin] = useState<"ALL" | "LIVE">("ALL");
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceEventId, setEvidenceEventId] = useState<string | null>(null);

  const events = usePoll(() => api.events({ cityId, limit: 100 }), 30_000, [cityId]);
  const overview = usePoll(() => api.overview(cityId), 90_000, [cityId]);

  const allEvents = events.data?.events ?? [];
  const visibleEvents = useMemo(
    () => (origin === "LIVE" ? allEvents.filter((e) => e.dataOrigin === "LIVE") : allEvents),
    [allEvents, origin]
  );

  const center = useMemo<[number, number]>(() => {
    const c = cities.find((x) => x.cityId === cityId);
    return c ? [c.latitude, c.longitude] : [17.385, 78.4867];
  }, [cities, cityId]);

  const activeId = selectedEventId ?? focusEventId;
  const selectedEvent = activeId ? allEvents.find((e) => e.id === activeId) ?? null : null;

  const chips = overview.data
    ? [
        { label: "Weather", m: overview.data.metrics.weather },
        { label: "Air quality", m: overview.data.metrics.airQuality },
      ]
    : [];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title="Live City"
        subtitle="Real-time geographic view — verified events only, coordinates from real sources"
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
                  {o === "LIVE" ? "LIVE ONLY" : "ALL ORIGINS"}
                </button>
              ))}
            </div>
            <div className="flex overflow-hidden rounded border border-[#1c2942]" role="group" aria-label="View mode">
              {(["2D", "3D"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  className={cn(
                    "px-2.5 py-1.5 text-[10px] font-bold tracking-wider transition-colors",
                    view === v ? "bg-purple-500/15 text-purple-300" : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {/* live metric chips (same data layer as Dashboard) */}
      <div className="flex flex-wrap items-center gap-2">
        {chips.length > 0 ? (
          chips.map(({ label, m }) => (
            <span key={label} className="flex items-center gap-2 rounded border border-[#1c2942] bg-[#0a101c] px-2.5 py-1.5 text-[11px]">
              <span className="text-slate-400">{label}</span>
              <span className="font-semibold text-slate-100">{m.status === "UNAVAILABLE" ? "—" : m.value}</span>
              <StatusPill status={m.status} small />
            </span>
          ))
        ) : (
          <span className="text-[11px] text-slate-500">Loading live metrics…</span>
        )}
        {focusEventId && (
          <button onClick={clearFocus} className="rounded border border-cyan-500/40 px-2 py-1 text-[10px] text-cyan-300 hover:bg-white/5">
            Clear map focus
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="h-[clamp(420px,calc(100vh-360px),720px)]">
            {events.loading && allEvents.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-lg border border-[#1c2942] bg-[#0a101c]">
                <LoadingBlock label="Loading city map…" />
              </div>
            ) : view === "2D" ? (
              <CityMap events={visibleEvents} selectedId={activeId} onSelect={selectEvent} focusTick={focusTick} center={center} />
            ) : (
              <City3D events={visibleEvents} selectedId={activeId} onSelect={selectEvent} />
            )}
          </div>

          <Panel title="Event stream" bodyClassName="p-0">
            <div className="max-h-[320px] overflow-y-auto [scrollbar-color:#1c2942_transparent] [scrollbar-width:thin]">
              <EventStream events={visibleEvents} selectedId={activeId} onSelect={selectEvent} newEventIds={new Set<string>()} />
            </div>
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col">
          {selectedEvent ? (
            <EventDetailPanel
              eventId={selectedEvent.id}
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
                Select a marker on the map or an entry in the stream. The detail panel shows the event, its Hindsight
                memory recall, the agent assessment, evidence and outcomes.
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

// keep type import used even if tree-shaken in some builds
export type { PublicEvent };
