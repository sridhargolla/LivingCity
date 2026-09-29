"use client";

// LIVING CITY — Analytics: every number on this page comes from data the system
// actually collected (stored events, real observations, Hindsight operations).
// Nothing is simulated; empty charts say so honestly.

import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { api } from "@/lib/city-api";
import { useAppStore } from "@/lib/store";
import { usePoll } from "@/hooks/usePoll";
import { timeAgo } from "@/lib/city-format";
import { PageHeader, Panel, LoadingBlock, ErrorBlock, EmptyHint } from "@/components/pages/shared";
import { cn } from "@/lib/utils";

const STACK_COLORS = ["#34d399", "#22d3ee", "#a78bfa", "#fbbf24", "#f87171", "#94a3b8", "#e879f9"];
const SEVERITY_COLORS: Record<string, string> = {
  INFO: "#64748b",
  MINOR: "#22d3ee",
  MODERATE: "#fbbf24",
  MAJOR: "#fb923c",
  CRITICAL: "#f87171",
};

const tooltipStyle = {
  backgroundColor: "#0d1526",
  border: "1px solid #1c2942",
  borderRadius: 6,
  fontSize: 11,
  color: "#e2e8f0",
} as const;

export function AnalyticsPage() {
  const cityId = useAppStore((s) => s.cityId);
  const setPage = useAppStore((s) => s.setPage);
  const selectEvent = useAppStore((s) => s.selectEvent);
  const [days, setDays] = useState<7 | 14 | 30>(14);

  const summary = usePoll(() => api.analyticsSummary({ cityId, days }), 120_000, [cityId, days]);
  const d = summary.data;

  const dayData = useMemo(() => {
    if (!d?.eventsByDay?.length) return [];
    return d.eventsByDay.map((r) => {
      const label = String((r as Record<string, string | number>).day ?? (r as Record<string, string | number>).t ?? "");
      return { ...r, label };
    });
  }, [d]);

  const stackKeys = useMemo(() => {
    if (!dayData.length) return [];
    return Object.keys(dayData[0]).filter((k) => k !== "label" && k !== "day" && k !== "t");
  }, [dayData]);

  const openEvent = (id: string) => {
    selectEvent(id);
    setPage("live-events");
  };

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title="Analytics"
        subtitle={d ? `${d.cityName} · ${d.windowDays}-day window · collected from real system data` : "Trends, patterns and anomalies from collected data"}
        right={
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded border border-[#1c2942]" role="group" aria-label="Window length">
              {([7, 14, 30] as const).map((n) => (
                <button
                  key={n}
                  onClick={() => setDays(n)}
                  aria-pressed={days === n}
                  className={cn(
                    "px-2.5 py-1.5 text-[10px] font-bold tracking-wider transition-colors",
                    days === n ? "bg-cyan-500/15 text-cyan-300" : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  {n}D
                </button>
              ))}
            </div>
            <button
              onClick={summary.refresh}
              className="flex items-center gap-1.5 rounded border border-[#1c2942] px-2.5 py-1.5 text-[11px] text-slate-300 hover:bg-white/5"
              aria-label="Refresh analytics"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        }
      />

      {summary.loading && !d ? (
        <Panel>
          <LoadingBlock label="Crunching collected data…" />
        </Panel>
      ) : summary.error && !d ? (
        <Panel title="Analytics">
          <ErrorBlock message={summary.error} />
        </Panel>
      ) : d ? (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              ["Events collected", d.totals.events],
              ["Active now", d.totals.active],
              ["Resolved", d.totals.resolved],
            ].map(([k, v]) => (
              <div key={k as string} className="rounded-lg border border-[#1c2942] bg-[#0a101c] p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{k}</p>
                <p className="mt-1 text-2xl font-bold text-slate-100">{v}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {/* events per day */}
            <Panel title="Events per day">
              {dayData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={dayData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="#141d31" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#1c2942" }} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    {stackKeys.length > 0 && <Legend wrapperStyle={{ fontSize: 10, color: "#94a3b8" }} />}
                    {stackKeys.map((k, i) => (
                      <Area key={k} type="monotone" dataKey={k} stackId="1" stroke={STACK_COLORS[i % STACK_COLORS.length]} fill={STACK_COLORS[i % STACK_COLORS.length]} fillOpacity={0.25} strokeWidth={1.5} />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyHint>No events collected in this window yet — charts fill automatically as live data arrives.</EmptyHint>
              )}
            </Panel>

            {/* severity mix */}
            <Panel title="Severity mix">
              {d.severityCounts.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={d.severityCounts} dataKey="count" nameKey="severity" innerRadius={52} outerRadius={82} paddingAngle={3} stroke="#0a101c">
                      {d.severityCounts.map((s) => (
                        <Cell key={s.severity} fill={SEVERITY_COLORS[s.severity] ?? "#94a3b8"} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 10, color: "#94a3b8" }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyHint>No severity data yet.</EmptyHint>
              )}
            </Panel>

            {/* event types */}
            <Panel title="Event types">
              {d.typeCounts.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(200, d.typeCounts.length * 34 + 40)}>
                  <BarChart data={d.typeCounts} layout="vertical" margin={{ top: 4, right: 16, left: 30, bottom: 0 }}>
                    <CartesianGrid stroke="#141d31" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#1c2942" }} allowDecimals={false} />
                    <YAxis type="category" dataKey="label" width={110} tick={{ fill: "#94a3b8", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="count" fill="#22d3ee" radius={[0, 3, 3, 0]} barSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyHint>No event types recorded yet.</EmptyHint>
              )}
            </Panel>

            {/* memory operations */}
            <Panel title="Hindsight operations (retain / recall / reflect)">
              {d.memoryOpsByDay.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={d.memoryOpsByDay} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="#141d31" vertical={false} />
                    <XAxis dataKey="day" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#1c2942" }} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 10, color: "#94a3b8" }} />
                    <Bar dataKey="RETAIN" stackId="m" fill="#34d399" barSize={16} />
                    <Bar dataKey="RECALL" stackId="m" fill="#22d3ee" barSize={16} />
                    <Bar dataKey="REFLECT" stackId="m" fill="#a78bfa" barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyHint>No memory operations recorded in this window yet.</EmptyHint>
              )}
            </Panel>

            {/* AQI trend */}
            <Panel title="Air quality (US AQI) — observed">
              {d.aqiSeries.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={d.aqiSeries} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="#141d31" vertical={false} />
                    <XAxis dataKey="t" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#1c2942" }} interval="preserveStartEnd" minTickGap={40} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line type="monotone" dataKey="aqi" stroke="#34d399" strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyHint>No air-quality observations stored yet — the series builds as the feed reports.</EmptyHint>
              )}
            </Panel>

            {/* precipitation */}
            <Panel title="Precipitation (mm/h) — observed">
              {d.precipSeries.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={d.precipSeries} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="#141d31" vertical={false} />
                    <XAxis dataKey="t" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#1c2942" }} interval="preserveStartEnd" minTickGap={40} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="mm" fill="#22d3ee" barSize={10} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyHint>No precipitation observations stored yet.</EmptyHint>
              )}
            </Panel>
          </div>

          {/* patterns + anomalies */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Panel title="Discovered patterns" right={<span className="text-[10px] text-slate-500">from real event relationships</span>}>
              {d.patterns.length > 0 ? (
                <ul className="flex max-h-[300px] flex-col gap-2 overflow-y-auto pr-1 [scrollbar-color:#1c2942_transparent] [scrollbar-width:thin]">
                  {d.patterns.map((p) => (
                    <li key={p.id} className="rounded border border-[#1c2942] bg-[#070d18] px-3 py-2 text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="rounded border border-purple-500/40 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-purple-300">
                          {p.relation.replace(/_/g, " ")}
                        </span>
                        <span className="text-slate-500">{(p.confidence * 100).toFixed(0)}% · basis: {p.basis}</span>
                      </div>
                      <p className="mt-1.5 leading-relaxed text-slate-300">{p.explanation}</p>
                      <div className="mt-1 flex gap-3 text-[10px] text-slate-500">
                        <button onClick={() => openEvent(p.from.id)} className="truncate hover:text-cyan-300">← {p.from.title}</button>
                        <button onClick={() => openEvent(p.to.id)} className="truncate hover:text-cyan-300">→ {p.to.title}</button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyHint>No patterns discovered yet in this window.</EmptyHint>
              )}
            </Panel>

            <Panel title="Anomalies" right={<span className="text-[10px] text-slate-500">deviations from the city's own baseline</span>}>
              {d.anomalies.length > 0 ? (
                <ul className="flex max-h-[300px] flex-col gap-2 overflow-y-auto pr-1 [scrollbar-color:#1c2942_transparent] [scrollbar-width:thin]">
                  {d.anomalies.map((a) => (
                    <li key={a.id} className="rounded border border-[#1c2942] bg-[#070d18] px-3 py-2 text-[11px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("rounded border px-1.5 py-0.5 text-[9px] font-bold tracking-wider", a.direction === "UP" ? "border-rose-500/40 text-rose-300" : "border-cyan-500/40 text-cyan-300")}>
                          {a.metric} {a.direction}
                        </span>
                        <span className="text-slate-500">deviation ×{a.deviation.toFixed(2)}</span>
                        <span className={cn("ml-auto text-[9px] uppercase tracking-wider", a.status === "OPEN" ? "text-amber-300" : "text-slate-500")}>{a.status}</span>
                      </div>
                      <p className="mt-1.5 leading-relaxed text-slate-300">{a.description}</p>
                      <p className="mt-1 text-[10px] text-slate-500">{timeAgo(a.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyHint>No anomalies detected — metrics are within the city's observed baseline.</EmptyHint>
              )}
            </Panel>
          </div>

          <p className="text-[10px] leading-relaxed text-slate-500">{d.note}</p>
        </>
      ) : null}
    </div>
  );
}
