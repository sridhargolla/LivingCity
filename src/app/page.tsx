"use client";

// LIVING CITY — command center. One city, one persona (city operations coordinator),
// one workflow: understand an incoming urban incident using current data + city memory.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { api, type PublicEvent } from "@/lib/city-api";
import { useRealtime } from "@/hooks/useRealtime";
import { HeaderBar } from "@/components/city/HeaderBar";
import { EventStream } from "@/components/city/EventStream";
import { EventDetailPanel } from "@/components/city/EventDetailPanel";
import { MemoryPanel } from "@/components/city/MemoryPanel";
import { MemoryTimeline } from "@/components/city/MemoryTimeline";
import { MemoryGraph } from "@/components/city/MemoryGraph";
import { FeedHealthPanel } from "@/components/city/FeedHealthPanel";
import { ReportDialog } from "@/components/city/ReportDialog";
import { DemoDialog } from "@/components/city/DemoDialog";

// Leaflet touches `window` at module scope → client-only load.
const CityMap = dynamic(
  () => import("@/components/map/CityMap").then((m) => m.CityMap),
  { ssr: false, loading: () => (
      <div className="flex h-full w-full items-center justify-center rounded-lg border border-[#1c2942] bg-slate-950">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400" />
      </div>
    ) }
);

export default function Page() {
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof api.city>> | null>(null);
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [hindsightAvailable, setHindsightAvailable] = useState<boolean | null>(null);
  const [mode, setMode] = useState<"ALL" | "LIVE">("ALL");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [newEventIds, setNewEventIds] = useState<Set<string>>(new Set());
  const [reportOpen, setReportOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const newIdsRef = useRef<Set<string>>(new Set());

  const refreshAll = useCallback(() => {
    setRefreshTick((t) => t + 1);
    api.city().then(setSummary).catch(() => undefined);
    api
      .events({ limit: 60 })
      .then((r) => setEvents(r.events))
      .catch(() => undefined);
    api
      .health()
      .then((h) => setHindsightAvailable(Boolean(h.hindsight?.available)))
      .catch(() => setHindsightAvailable(false));
  }, []);

  useEffect(() => {
    const t0 = setTimeout(refreshAll, 0);
    const t = setInterval(refreshAll, 60000); // slow reconcile; SSE handles immediacy
    return () => {
      clearTimeout(t0);
      clearInterval(t);
    };
  }, [refreshAll]);

  const onRealtime = useCallback(
    (p: { event: string; data: Record<string, unknown> }) => {
      if (p.event === "event.created") {
        const ev = p.data.event as PublicEvent | undefined;
        if (ev) {
          newIdsRef.current.add(ev.id);
          setNewEventIds(new Set(newIdsRef.current));
          setToast(`New event: ${ev.title}`);
          setTimeout(() => setToast(null), 4000);
        }
      }
      // any pipeline activity refreshes memory-driven panels (debounced)
      const delay = p.event === "analysis.completed" ? 1200 : 400;
      setTimeout(() => setRefreshTick((t) => t + 1), delay);
    },
    []
  );

  const { connected } = useRealtime(onRealtime);

  // slow periodic clear of "new" highlight
  useEffect(() => {
    const t = setInterval(() => {
      if (newIdsRef.current.size > 0) {
        newIdsRef.current = new Set();
        setNewEventIds(new Set());
      }
    }, 12000);
    return () => clearInterval(t);
  }, []);

  const visibleEvents = useMemo(
    () => (mode === "LIVE" ? events.filter((e) => e.dataOrigin === "LIVE") : events),
    [events, mode]
  );

  const selectEvent = useCallback((id: string) => setSelectedId(id), []);

  return (
    <div className="lc-root flex min-h-screen flex-col">
      <div className="lc-scanline flex min-h-screen flex-col">
        <HeaderBar
          summary={summary}
          realtimeConnected={connected}
          hindsightAvailable={hindsightAvailable}
          mode={mode}
          onModeChange={setMode}
          onOpenReport={() => setReportOpen(true)}
          onOpenDemo={() => setDemoOpen(true)}
        />

        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-4">
          <div className="grid gap-4 xl:grid-cols-[1fr_400px]">
            {/* ── left: map + stream + timeline + graph ── */}
            <div className="flex min-w-0 flex-col gap-4">
              <div className="h-[440px]">
                <CityMap events={visibleEvents} selectedId={selectedId} onSelect={selectEvent} />
              </div>
              <EventStream
                events={visibleEvents}
                selectedId={selectedId}
                onSelect={selectEvent}
                newEventIds={newEventIds}
              />
              <MemoryTimeline refreshTick={refreshTick} onSelectEvent={selectEvent} selectedId={selectedId} />
              <MemoryGraph onSelectEvent={selectEvent} />
            </div>

            {/* ── right: detail / memory / feeds ── */}
            <div className="flex min-w-0 flex-col gap-4">
              {selectedId ? (
                <div className="flex min-h-0 flex-col" style={{ minHeight: 520 }}>
                  <EventDetailPanel
                    eventId={selectedId}
                    events={visibleEvents}
                    onSelect={selectEvent}
                    onClose={() => setSelectedId(null)}
                    refreshTick={refreshTick}
                  />
                </div>
              ) : (
                <section className="flex h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#1c2942] bg-[#0a101c]/60 text-center">
                  <span className="text-xl opacity-40">🖱️</span>
                  <p className="text-xs text-slate-500">Select an event on the map or stream</p>
                  <p className="max-w-xs text-[11px] text-slate-600">
                    The detail panel shows the event, its Hindsight memory recall, the agent assessment, and what was learned.
                  </p>
                </section>
              )}
              <MemoryPanel refreshTick={refreshTick} hindsightAvailable={hindsightAvailable} onSelectEvent={selectEvent} />
              <FeedHealthPanel refreshTick={refreshTick} />
            </div>
          </div>
        </main>

        <footer className="mt-auto border-t border-[#1c2942] bg-[#05080f]">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2 px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
            <p className="text-[10px] uppercase tracking-[0.24em] text-slate-600">
              Living City — Hyderabad · city memory by Hindsight
            </p>
            <p className="text-[10px] text-slate-600">
              Evidence-based, hedged language only · origins labeled LIVE / SIMULATED / USER-REPORTED
            </p>
          </div>
        </footer>
      </div>

      {/* overlays */}
      <ReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        onSubmitted={(eventId) => {
          setSelectedId(eventId);
          refreshAll();
        }}
      />
      <DemoDialog open={demoOpen} onClose={() => setDemoOpen(false)} onFinished={refreshAll} />

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[2100] -translate-x-1/2 rounded border border-cyan-500/40 bg-[#0d1526] px-4 py-2.5 text-[12px] text-cyan-200 shadow-lg shadow-cyan-500/10">
          {toast}
        </div>
      )}
    </div>
  );
}
