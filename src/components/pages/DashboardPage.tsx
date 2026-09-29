"use client";

// LIVING CITY — Dashboard: real-time city overview. Every metric is labeled with
// its true status (LIVE / DEGRADED / DATA UNAVAILABLE). Insights are generated
// only from verified live data, real events and Hindsight memory — never invented.

import { useMemo, useState } from "react";
import { RefreshCw, MapPin, ListPlus } from "lucide-react";
import { api, type PublicEvent } from "@/lib/city-api";
import { useAppStore } from "@/lib/store";
import { usePoll } from "@/hooks/usePoll";
import { timeAgo } from "@/lib/city-format";
import { EventStream } from "@/components/city/EventStream";
import { PageHeader, Panel, MetricTile, StatusPill, LoadingBlock, ErrorBlock, EmptyHint } from "@/components/pages/shared";

const BASIS_META: Record<string, { label: string; cls: string }> = {
  live: { label: "LIVE DATA", cls: "text-emerald-300 border-emerald-500/40" },
  memory: { label: "CITY MEMORY", cls: "text-purple-300 border-purple-500/40" },
  event: { label: "EVENT", cls: "text-cyan-300 border-cyan-500/40" },
};

const SEVERE = new Set(["MODERATE", "MAJOR", "CRITICAL"]);

export function DashboardPage() {
  const cityId = useAppStore((s) => s.cityId);
  const setPage = useAppStore((s) => s.setPage);
  const selectEvent = useAppStore((s) => s.selectEvent);
  const focusEvent = useAppStore((s) => s.focusEvent);
  const [toast, setToast] = useState<string | null>(null);

  const overview = usePoll(() => api.overview(cityId), 60_000, [cityId]);
  const insights = usePoll(() => api.insights(cityId), 120_000, [cityId]);
  const memories = usePoll(() => api.memories({ cityId, limit: 4 }), 120_000, [cityId]);
  const stats = usePoll(() => api.memoryStats(), 120_000, []);
  const events = usePoll(() => api.events({ cityId, limit: 40 }), 30_000, [cityId]);

  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 4000);
  };

  const openOnMap = (eventId: string) => {
    focusEvent(eventId);
    selectEvent(eventId);
    setPage("live-city");
  };
  const openInEvents = (eventId: string) => {
    selectEvent(eventId);
    setPage("live-events");
  };

  const o = overview.data;
  const cm = stats.data?.cityMemory;
  const recentEvents: PublicEvent[] = o?.recentEvents ?? events.data?.events ?? [];

  const alertCounts = useMemo(() => {
    const a = o?.alerts ?? [];
    return { total: a.length, severe: a.filter((x) => SEVERE.has(x.severity)).length };
  }, [o]);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title="Dashboard"
        subtitle={`${o?.cityName ?? "…"} · real-time city intelligence · updated ${o ? timeAgo(o.lastUpdated) : "—"}`}
        right={
          <button
            onClick={() => {
              overview.refresh();
              insights.refresh();
              events.refresh();
            }}
            className="flex items-center gap-1.5 rounded border border-[#1c2942] px-2.5 py-1.5 text-[11px] text-slate-300 transition-colors hover:bg-white/5"
            aria-label="Refresh dashboard data"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Refresh
          </button>
        }
      />

      {/* metric cards — honest status per metric */}
      {overview.loading && !o ? (
        <Panel>
          <LoadingBlock label="Loading city overview…" />
        </Panel>
      ) : overview.error && !o ? (
        <Panel title="City metrics">
          <ErrorBlock message={overview.error} />
        </Panel>
      ) : o ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile m={o.metrics.weather} />
          <MetricTile m={o.metrics.airQuality} />
          <MetricTile m={o.metrics.traffic} />
          <MetricTile m={o.metrics.transit} />
        </div>
      ) : null}

      {/* live detail strip (only when real data exists) */}
      {o?.weatherDetail && (
        <Panel title="Weather detail" right={<StatusPill status={o.metrics.weather.status} small />}>
          <div className="flex flex-wrap gap-2 text-[11px]">
            {[
              o.weatherDetail.condition,
              o.weatherDetail.temperatureC !== null && `${Math.round(o.weatherDetail.temperatureC)}°C`,
              o.weatherDetail.humidityPct !== null && `Humidity ${Math.round(o.weatherDetail.humidityPct)}%`,
              o.weatherDetail.precipMm !== null && `Precip ${o.weatherDetail.precipMm} mm/h`,
              o.weatherDetail.windKmh !== null && `Wind ${Math.round(o.weatherDetail.windKmh)} km/h`,
              o.weatherDetail.cloudCover !== null && `Cloud ${Math.round(o.weatherDetail.cloudCover)}%`,
              o.weatherDetail.forecast && `Next 24h: ~${o.weatherDetail.forecast.expectedMm} mm (${o.weatherDetail.forecast.maxPrecipProb}% prob)`,
            ]
              .filter(Boolean)
              .map((chip, i) => (
                <span key={i} className="rounded border border-[#1c2942] bg-[#070d18] px-2 py-1 text-slate-300">
                  {chip as string}
                </span>
              ))}
          </div>
        </Panel>
      )}
      {o?.airQualityDetail && (
        <Panel title="Air quality detail" right={<StatusPill status={o.metrics.airQuality.status} small />}>
          <div className="flex flex-wrap gap-2 text-[11px]">
            {[
              o.airQualityDetail.category,
              o.airQualityDetail.usAqi !== null && `US AQI ${Math.round(o.airQualityDetail.usAqi)}`,
              o.airQualityDetail.pm25 !== null && `PM2.5 ${o.airQualityDetail.pm25} µg/m³`,
              o.airQualityDetail.pm10 !== null && `PM10 ${o.airQualityDetail.pm10} µg/m³`,
            ]
              .filter(Boolean)
              .map((chip, i) => (
                <span key={i} className="rounded border border-[#1c2942] bg-[#070d18] px-2 py-1 text-slate-300">
                  {chip as string}
                </span>
              ))}
          </div>
        </Panel>
      )}

      {/* alerts */}
      {o && o.alerts.length > 0 && (
        <Panel
          title={`City alerts (${alertCounts.total})`}
          right={<span className="text-[10px] uppercase tracking-wider text-slate-500">from verified events</span>}
        >
          <ul className="flex flex-col gap-2">
            {o.alerts.slice(0, 5).map((a) => (
              <li
                key={a.id}
                className={`flex flex-wrap items-center gap-2 rounded border px-3 py-2 text-[11px] ${
                  SEVERE.has(a.severity) ? "border-rose-500/30 bg-rose-500/5" : "border-[#1c2942] bg-[#070d18]"
                }`}
              >
                <span className={`font-bold uppercase tracking-wider ${SEVERE.has(a.severity) ? "text-rose-300" : "text-slate-400"}`}>
                  {a.severity}
                </span>
                <span className="min-w-0 flex-1 text-slate-200">{a.title}</span>
                <span className="text-slate-500">{timeAgo(a.observedAt)}</span>
                <button onClick={() => openOnMap(a.eventId)} className="rounded border border-[#1c2942] px-2 py-0.5 text-[10px] text-cyan-300 hover:bg-white/5">
                  <MapPin className="mr-1 inline h-3 w-3" aria-hidden /> Map
                </button>
                <button onClick={() => openInEvents(a.eventId)} className="rounded border border-[#1c2942] px-2 py-0.5 text-[10px] text-slate-300 hover:bg-white/5">
                  <ListPlus className="mr-1 inline h-3 w-3" aria-hidden /> Details
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* AI insights — grounded only */}
        <Panel
          title="AI insights"
          right={
            insights.data?.degraded ? (
              <span className="text-[10px] uppercase tracking-wider text-amber-300">degraded mode</span>
            ) : (
              <span className="text-[10px] uppercase tracking-wider text-slate-500">grounded in live data + memory</span>
            )
          }
        >
          {insights.loading && !insights.data ? (
            <LoadingBlock label="Generating insights…" />
          ) : insights.error ? (
            <ErrorBlock message={insights.error} />
          ) : insights.data && insights.data.insights.length > 0 ? (
            <>
              <ul className="flex flex-col gap-2">
                {insights.data.insights.map((ins, i) => {
                  const b = BASIS_META[ins.basis] ?? BASIS_META.live;
                  return (
                    <li key={i} className="rounded border border-[#1c2942] bg-[#070d18] px-3 py-2">
                      <p className="text-[12px] leading-relaxed text-slate-200">{ins.text}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold tracking-wider ${b.cls}`}>{b.label}</span>
                        {ins.refEventId && (
                          <button
                            onClick={() => openInEvents(ins.refEventId!)}
                            className="text-[10px] text-cyan-300 underline-offset-2 hover:underline"
                          >
                            View event
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-[10px] text-slate-500">{insights.data.note}</p>
            </>
          ) : (
            <EmptyHint>
              No insights yet — they appear once verified live data, real events or city memories are available.
            </EmptyHint>
          )}
        </Panel>

        {/* city memory summary */}
        <Panel
          title="City memory (Hindsight)"
          right={
            <button onClick={() => setPage("memories")} className="text-[10px] uppercase tracking-wider text-cyan-300 hover:underline">
              Open Memories →
            </button>
          }
        >
          {cm ? (
            <>
              <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
                {[
                  ["Bank", String(cm.bankMemoryCount ?? "—")],
                  ["Retains", String(cm.retains)],
                  ["Recalls", String(cm.recalls)],
                  ["Patterns", String(cm.patternsDiscovered)],
                ].map(([k, v]) => (
                  <div key={k} className="rounded border border-[#1c2942] bg-[#070d18] px-2.5 py-2">
                    <p className="text-[9px] uppercase tracking-wider text-slate-500">{k}</p>
                    <p className="mt-0.5 text-base font-bold text-slate-100">{v}</p>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-slate-500">
                Bank <span className="text-slate-400">{cm.bankId}</span> ·{" "}
                {cm.lastMemoryUpdate ? `last update ${timeAgo(cm.lastMemoryUpdate)}` : "no updates yet"}
                {cm.lastMemoryUpdateStatus ? ` (${cm.lastMemoryUpdateStatus})` : ""}
              </p>
              <div className="mt-3 flex flex-col gap-1.5">
                {memories.data && memories.data.items.length > 0 ? (
                  memories.data.items.slice(0, 4).map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setPage("memories")}
                      className="truncate rounded border border-[#1c2942] bg-[#070d18] px-3 py-2 text-left text-[11px] text-slate-300 transition-colors hover:bg-white/5"
                      title={m.text}
                    >
                      <span className="mr-1.5 text-purple-300">🧠</span>
                      {m.text.slice(0, 120)}
                      {m.text.length > 120 ? "…" : ""}
                    </button>
                  ))
                ) : (
                  <EmptyHint>No recent memories — the city retains experience as real events resolve.</EmptyHint>
                )}
              </div>
              {!cm.hindsightAvailable && (
                <p className="mt-2 rounded border border-amber-500/30 bg-amber-500/5 px-2.5 py-1.5 text-[10px] text-amber-300">
                  Hindsight is unreachable — running in honest degraded mode. New retains/recalls are paused; nothing is faked.
                </p>
              )}
            </>
          ) : (
            <LoadingBlock label="Loading memory stats…" />
          )}
        </Panel>
      </div>

      {/* live event stream (EventStream renders its own header) */}
      <Panel bodyClassName="p-0">
        <div className="max-h-[420px] overflow-y-auto p-0 [scrollbar-color:#1c2942_transparent] [scrollbar-width:thin]">
          <EventStream events={recentEvents} selectedId={null} onSelect={openInEvents} newEventIds={new Set<string>()} />
        </div>
      </Panel>

      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 z-[2100] -translate-x-1/2 rounded border border-cyan-500/40 bg-[#0d1526] px-4 py-2.5 text-[12px] text-cyan-200 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
