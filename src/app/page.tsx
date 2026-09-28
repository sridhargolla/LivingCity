"use client";

// LIVING CITY — command center. One persona (city operations coordinator), one
// workflow: understand an incoming urban incident using current data + city memory.
// PHASES 1-17 integrated: copilot chat with actions, evidence, city state, learning,
// anomalies, human feedback, what-if, multi-city, 2D/3D views, voice.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { api, type ChatAction, type PublicEvent } from "@/lib/city-api";
import { useRealtime } from "@/hooks/useRealtime";
import { isSafeExternalUrlClient } from "@/lib/city-format";
import { HeaderBar, type CityOption } from "@/components/city/HeaderBar";
import { CityStateStrip } from "@/components/city/CityStateStrip";
import { AnomalyBanner } from "@/components/city/AnomalyBanner";
import { EventStream } from "@/components/city/EventStream";
import { EventDetailPanel } from "@/components/city/EventDetailPanel";
import { ChatPanel } from "@/components/city/ChatPanel";
import { MemoryPanel } from "@/components/city/MemoryPanel";
import { MemoryTimeline } from "@/components/city/MemoryTimeline";
import { MemoryGraph } from "@/components/city/MemoryGraph";
import { FeedHealthPanel } from "@/components/city/FeedHealthPanel";
import { LearningPanel } from "@/components/city/LearningPanel";
import { ReportDialog } from "@/components/city/ReportDialog";
import { DemoDialog } from "@/components/city/DemoDialog";
import { EvidenceDialog } from "@/components/city/EvidenceDialog";
import { WhatIfDialog } from "@/components/city/WhatIfDialog";

// Leaflet touches `window` at module scope → client-only load.
const CityMap = dynamic(
  () => import("@/components/map/CityMap").then((m) => m.CityMap),
  { ssr: false, loading: () => (
      <div className="flex h-full w-full items-center justify-center rounded-lg border border-[#1c2942] bg-slate-950">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400" />
      </div>
    ) }
);

// Three.js heavy → client-only load. If it fails, 2D remains available.
const City3D = dynamic(
  () => import("@/components/map/City3D").then((m) => m.City3D),
  { ssr: false, loading: () => (
      <div className="flex h-full w-full items-center justify-center rounded-lg border border-[#1c2942] bg-slate-950">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-500/30 border-t-purple-400" />
      </div>
    ) }
);

type RightTab = "EVENT" | "MEMORY" | "LEARNING" | "FEEDS";

export default function Page() {
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof api.city>> | null>(null);
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [hindsightAvailable, setHindsightAvailable] = useState<boolean | null>(null);
  const [mode, setMode] = useState<"ALL" | "LIVE">("ALL");
  const [view, setView] = useState<"2D" | "3D">("2D");
  const [cities, setCities] = useState<Array<CityOption & { latitude: number; longitude: number }>>([
    { cityId: "hyderabad", name: "Hyderabad", country: "India", primary: true, latitude: 17.385, longitude: 78.4867 },
  ]);
  const [cityId, setCityId] = useState("hyderabad");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const [newEventIds, setNewEventIds] = useState<Set<string>>(new Set());
  const [reportOpen, setReportOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceEventId, setEvidenceEventId] = useState<string | null>(null);
  const [whatIfOpen, setWhatIfOpen] = useState(false);
  const [whatIfEventId, setWhatIfEventId] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<RightTab>("EVENT");
  const [simulatorRunning, setSimulatorRunning] = useState(false);
  const [focusTick, setFocusTick] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const newIdsRef = useRef<Set<string>>(new Set());

  const cityMeta = cities.find((c) => c.cityId === cityId);

  const refreshAll = useCallback(() => {
    setRefreshTick((t) => t + 1);
    api.city(cityId).then(setSummary).catch(() => undefined);
    api
      .events({ limit: 60, cityId })
      .then((r) => setEvents(r.events))
      .catch(() => undefined);
    api
      .health()
      .then((h) => setHindsightAvailable(Boolean(h.hindsight?.available)))
      .catch(() => setHindsightAvailable(false));
  }, [cityId]);

  useEffect(() => {
    const t0 = setTimeout(refreshAll, 0);
    const t = setInterval(refreshAll, 60000); // slow reconcile; SSE handles immediacy
    return () => {
      clearTimeout(t0);
      clearInterval(t);
    };
  }, [refreshAll]);

  useEffect(() => {
    api
      .cities()
      .then((r) =>
        setCities(
          r.cities.map((c) => ({
            cityId: c.cityId,
            name: c.name,
            country: c.country,
            primary: c.primary,
            latitude: c.latitude,
            longitude: c.longitude,
          }))
        )
      )
      .catch(() => undefined);
    api
      .simulatorStatus()
      .then((r) => setSimulatorRunning(r.status.running))
      .catch(() => undefined);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4200);
  }, []);

  const onRealtime = useCallback(
    (p: { event: string; data: Record<string, unknown> }) => {
      if (p.event === "event.created") {
        const ev = p.data.event as PublicEvent | undefined;
        if (ev && (ev.cityId ?? "hyderabad") === cityId) {
          newIdsRef.current.add(ev.id);
          setNewEventIds(new Set(newIdsRef.current));
          showToast(`New event: ${ev.title}`);
        }
      }
      if (p.event === "anomaly.detected") {
        const metric = String(p.data.metric ?? "");
        showToast(`⚠ Anomaly detected: ${metric} deviation from baseline`);
      }
      // any pipeline activity refreshes memory-driven panels (debounced)
      const delay = p.event === "analysis.completed" ? 1200 : 400;
      setTimeout(() => setRefreshTick((t) => t + 1), delay);
    },
    [cityId, showToast]
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

  const selectEvent = useCallback((id: string) => {
    setSelectedId(id);
    setRightTab("EVENT");
  }, []);

  // ── Chat → UI actions (PHASE 7). Only validated structured actions reach here. ──
  const handleChatAction = useCallback(
    (a: ChatAction) => {
      switch (a.type) {
        case "open_event":
        case "open_historical_event":
          if (a.eventId) {
            const ev = events.find((e) => e.id === a.eventId);
            if (ev) {
              selectEvent(a.eventId);
              showToast(`Opened: ${ev.title.slice(0, 60)}`);
            } else showToast("That event is not in the current list (may belong to another city or window).");
          }
          break;
        case "focus_map":
          if (a.eventId) {
            const ev = events.find((e) => e.id === a.eventId);
            if (ev) {
              setSelectedId(a.eventId);
              setFocusTick((t) => t + 1);
              showToast("Map focused on the event.");
            } else showToast("That event is not on the current map.");
          }
          break;
        case "show_evidence":
          if (a.eventId) {
            setEvidenceEventId(a.eventId);
            setEvidenceOpen(true);
          }
          break;
        case "open_source":
          if (a.url && isSafeExternalUrlClient(a.url)) {
            window.open(a.url, "_blank", "noopener,noreferrer");
          } else {
            showToast("That source URL is not on the verified allowlist — refusing to open it.");
          }
          break;
        case "open_memory":
          setRightTab("MEMORY");
          showToast(a.memoryId ? `Memory ${a.memoryId.slice(0, 10)}… — see the operations log.` : "Memory panel opened.");
          break;
        case "show_related_events":
          if (a.eventId) selectEvent(a.eventId);
          else setRightTab("EVENT");
          showToast("Linked events are listed in the event panel.");
          break;
        case "show_memory_graph": {
          setRightTab("MEMORY");
          setTimeout(() => {
            document.getElementById("lc-memory-graph")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 150);
          break;
        }
        case "show_conversation":
          showToast("Conversation list is in the chat panel header (☰).");
          break;
        case "retain_memory":
          showToast('Use "Remember this …" in the chat to store an operator-requested experience.');
          break;
        case "run_scenario":
          setWhatIfEventId(a.eventId ?? selectedId);
          setWhatIfOpen(true);
          break;
        default:
          break;
      }
    },
    [events, selectEvent, selectedId, showToast]
  );

  const toggleSimulator = useCallback(async () => {
    try {
      if (simulatorRunning) {
        await api.simulator("stop", cityId);
        setSimulatorRunning(false);
        showToast("City Pulse stopped — autonomous simulated incidents paused.");
      } else {
        await api.simulator("start", cityId, undefined, 90000);
        setSimulatorRunning(true);
        showToast("City Pulse running — SIMULATED incidents will appear every ~90s (labeled, never live).");
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Simulator control failed.");
    }
  }, [cityId, simulatorRunning, showToast]);

  const cityCenter: [number, number] = useMemo(() => {
    const c = cities.find((x) => x.cityId === cityId);
    return c ? [c.latitude, c.longitude] : [17.385, 78.4867];
  }, [cityId, cities]);

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
          cities={cities}
          activeCityId={cityId}
          onCityChange={(id) => {
            setCityId(id);
            setSelectedId(null);
          }}
          view={view}
          onViewChange={setView}
          simulatorRunning={simulatorRunning}
          onSimulatorToggle={toggleSimulator}
        />

        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-4">
          {/* operator dashboard cards with provenance */}
          <CityStateStrip cityId={cityId} refreshTick={refreshTick} />

          <div className="mt-3">
            <AnomalyBanner cityId={cityId} refreshTick={refreshTick} onSelectEvent={selectEvent} />
          </div>

          <div className="mt-3 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px_minmax(0,400px)]">
            {/* ── col 1: map + stream + timeline + graph ── */}
            <div className="flex min-w-0 flex-col gap-4">
              <div className="h-[420px]">
                {view === "2D" ? (
                  <CityMap events={visibleEvents} selectedId={selectedId} onSelect={selectEvent} focusTick={focusTick} center={cityCenter} />
                ) : (
                  <City3D events={visibleEvents} selectedId={selectedId} onSelect={selectEvent} />
                )}
              </div>
              <EventStream
                events={visibleEvents}
                selectedId={selectedId}
                onSelect={selectEvent}
                newEventIds={newEventIds}
              />
              <MemoryTimeline refreshTick={refreshTick} onSelectEvent={selectEvent} selectedId={selectedId} />
              <div id="lc-memory-graph">
                <MemoryGraph onSelectEvent={selectEvent} />
              </div>
            </div>

            {/* ── col 2: ASK THE CITY copilot ── */}
            <div className="flex min-w-0 flex-col">
              <div className="sticky top-[76px] flex h-[calc(100vh-120px)] min-h-[520px] flex-col">
                <ChatPanel
                  cityId={cityId}
                  cityName={cityMeta?.name ?? summary?.city ?? "Hyderabad"}
                  selectedEventId={selectedId}
                  onAction={handleChatAction}
                  onMessagesChanged={() => setRefreshTick((t) => t + 1)}
                />
              </div>
            </div>

            {/* ── col 3: right tabs ── */}
            <div className="flex min-w-0 flex-col">
              <div className="mb-2 flex overflow-hidden rounded-md border border-[#1c2942]" role="tablist" aria-label="Detail tabs">
                {(["EVENT", "MEMORY", "LEARNING", "FEEDS"] as const).map((t) => (
                  <button
                    key={t}
                    role="tab"
                    aria-selected={rightTab === t}
                    onClick={() => setRightTab(t)}
                    className={`flex-1 px-2 py-2 text-[10px] font-bold tracking-wider transition-colors ${
                      rightTab === t ? "bg-cyan-500/15 text-cyan-300" : "bg-transparent text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {t === "EVENT" ? "EVENT" : t === "MEMORY" ? "🧠 MEMORY" : t === "LEARNING" ? "📚 LEARNING" : "FEEDS"}
                  </button>
                ))}
              </div>

              {rightTab === "EVENT" && (
                selectedId ? (
                  <div className="flex min-h-0 flex-col" style={{ minHeight: 560 }}>
                    <EventDetailPanel
                      eventId={selectedId}
                      events={visibleEvents}
                      onSelect={selectEvent}
                      onClose={() => setSelectedId(null)}
                      refreshTick={refreshTick}
                      onRunWhatIf={(id) => {
                        setWhatIfEventId(id);
                        setWhatIfOpen(true);
                      }}
                      onShowEvidence={(id) => {
                        setEvidenceEventId(id);
                        setEvidenceOpen(true);
                      }}
                    />
                  </div>
                ) : (
                  <section className="flex h-56 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#1c2942] bg-[#0a101c]/60 text-center">
                    <span className="text-xl opacity-40">🖱️</span>
                    <p className="text-xs text-slate-500">Select an event on the map or stream</p>
                    <p className="max-w-xs text-[11px] text-slate-600">
                      The detail panel shows the event, its Hindsight memory recall, the agent assessment, evidence, human feedback, and what was learned.
                    </p>
                  </section>
                )
              )}

              {rightTab === "MEMORY" && (
                <div className="flex min-h-0 flex-col gap-4">
                  <MemoryPanel refreshTick={refreshTick} hindsightAvailable={hindsightAvailable} onSelectEvent={selectEvent} />
                </div>
              )}

              {rightTab === "LEARNING" && (
                <div className="rounded-lg border border-[#1c2942] bg-[#0a101c] p-4">
                  <LearningPanel
                    cityId={cityId}
                    refreshTick={refreshTick}
                    onSelectEvent={selectEvent}
                    onOpenMemoryGraph={() => {
                      document.getElementById("lc-memory-graph")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                  />
                </div>
              )}

              {rightTab === "FEEDS" && <FeedHealthPanel refreshTick={refreshTick} />}
            </div>
          </div>
        </main>

        <footer className="mt-auto border-t border-[#1c2942] bg-[#05080f]">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2 px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
            <p className="text-[10px] uppercase tracking-[0.24em] text-slate-600">
              Living City — {cityMeta?.name ?? "Hyderabad"} · city memory by Hindsight
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
          setSelectedId(id);
          setFocusTick((t) => t + 1);
        }}
      />

      <WhatIfDialog
        open={whatIfOpen}
        cityId={cityId}
        cityName={cityMeta?.name ?? "Hyderabad"}
        eventId={whatIfEventId}
        eventTitle={events.find((e) => e.id === whatIfEventId)?.title ?? null}
        onClose={() => {
          setWhatIfOpen(false);
          setWhatIfEventId(null);
        }}
      />

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[2100] max-w-md -translate-x-1/2 rounded border border-cyan-500/40 bg-[#0d1526] px-4 py-2.5 text-[12px] text-cyan-200 shadow-lg shadow-cyan-500/10">
          {toast}
        </div>
      )}
    </div>
  );
}
