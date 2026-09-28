"use client";

import { ORIGIN_META } from "@/lib/city-format";
import type { CitySummary } from "@/lib/city-api";

export interface CityOption {
  cityId: string;
  name: string;
  country: string;
  primary: boolean;
}

interface HeaderBarProps {
  summary: CitySummary | null;
  realtimeConnected: boolean;
  hindsightAvailable: boolean | null;
  mode: "ALL" | "LIVE";
  onModeChange: (m: "ALL" | "LIVE") => void;
  onOpenReport: () => void;
  onOpenDemo: () => void;
  refreshing?: boolean;
  cities: CityOption[];
  activeCityId: string;
  onCityChange: (cityId: string) => void;
  view: "2D" | "3D";
  onViewChange: (v: "2D" | "3D") => void;
  simulatorRunning: boolean;
  onSimulatorToggle: () => void;
}

export function HeaderBar({
  summary,
  realtimeConnected,
  hindsightAvailable,
  mode,
  onModeChange,
  onOpenReport,
  onOpenDemo,
  cities,
  activeCityId,
  onCityChange,
  view,
  onViewChange,
  simulatorRunning,
  onSimulatorToggle,
}: HeaderBarProps) {
  const s = summary?.stats;
  const cityName = cities.find((c) => c.cityId === activeCityId)?.name ?? summary?.city ?? "Hyderabad";
  return (
    <header className="sticky top-0 z-[1400] border-b border-[#1c2942] bg-[#05080f]/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
        {/* identity */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-lg">
            🧠
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight tracking-[0.18em] text-slate-100">
              LIVING CITY
            </h1>
            <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-400/80">
              {cityName} — a city that remembers
            </p>
          </div>
        </div>

        {/* city switcher */}
        <label className="flex items-center gap-2 rounded-md border border-[#1c2942] bg-[#0a101c] px-2.5 py-1.5" title="City context — each city has isolated events and its own Hindsight memory bank">
          <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">City</span>
          <select
            value={activeCityId}
            onChange={(e) => onCityChange(e.target.value)}
            className="bg-transparent text-xs font-semibold text-slate-200 focus:outline-none"
            aria-label="Select city"
          >
            {cities.map((c) => (
              <option key={c.cityId} value={c.cityId} className="bg-[#0d1526]">
                {c.name}
              </option>
            ))}
          </select>
        </label>

        {/* live indicator */}
        <div className="flex items-center gap-2 rounded-md border border-[#1c2942] bg-[#0a101c] px-3 py-1.5">
          <span
            className={`lc-live-dot ${realtimeConnected ? "" : "!bg-red-400 !shadow-red-400"}`}
            aria-hidden
          />
          <span className="text-xs font-semibold tracking-wider text-slate-300">
            {realtimeConnected ? "LIVE" : "OFFLINE"}
          </span>
          <span className="ml-1 hidden text-[10px] uppercase tracking-wider text-slate-500 sm:inline">
            {realtimeConnected ? "stream connected" : "reconnecting…"}
          </span>
        </div>

        {/* stats */}
        <div className="flex flex-1 flex-wrap items-center gap-2" role="status" aria-label="City statistics">
          <Stat label="Active" value={s?.active} accent="text-rose-300" />
          <Stat label="Developing" value={s?.developing} accent="text-amber-300" />
          <Stat label="Resolved" value={s?.resolved} accent="text-emerald-300" />
          <div className="hidden items-center gap-2 xl:flex">
            {(["LIVE", "SIMULATED", "USER_REPORTED"] as const).map((o) => (
              <span
                key={o}
                className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-wider ${ORIGIN_META[o].badge}`}
                title={`${s?.byOrigin[o] ?? 0} ${o} events`}
              >
                {ORIGIN_META[o].label}: {s?.byOrigin[o] ?? 0}
              </span>
            ))}
          </div>
        </div>

        {/* view + mode + actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-[#1c2942]" role="tablist" aria-label="Map view">
            {(["2D", "3D"] as const).map((v) => (
              <button
                key={v}
                role="tab"
                aria-selected={view === v}
                onClick={() => onViewChange(v)}
                className={`px-2.5 py-1.5 text-xs font-semibold tracking-wider transition-colors ${
                  view === v ? "bg-purple-500/15 text-purple-300" : "bg-transparent text-slate-500 hover:text-slate-300"
                }`}
              >
                {v === "2D" ? "2D MAP" : "🧊 3D"}
              </button>
            ))}
          </div>
          <div className="flex overflow-hidden rounded-md border border-[#1c2942]" role="tablist" aria-label="Data mode">
            {(["ALL", "LIVE"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={mode === m}
                onClick={() => onModeChange(m)}
                className={`px-3 py-1.5 text-xs font-semibold tracking-wider transition-colors ${
                  mode === m ? "bg-cyan-500/15 text-cyan-300" : "bg-transparent text-slate-500 hover:text-slate-300"
                }`}
              >
                {m === "ALL" ? "ALL DATA" : "LIVE ONLY"}
              </button>
            ))}
          </div>
          <button
            onClick={onSimulatorToggle}
            title="Autonomous simulated incidents — every generated event is labeled SIMULATED"
            className={`rounded-md border px-3 py-1.5 text-xs font-semibold tracking-wider transition-colors ${
              simulatorRunning
                ? "border-purple-500/50 bg-purple-500/20 text-purple-200"
                : "border-[#1c2942] bg-[#0d1526] text-slate-400 hover:border-purple-500/40 hover:text-purple-300"
            }`}
          >
            {simulatorRunning ? "⏸ CITY PULSE" : "▶ CITY PULSE"}
          </button>
          <button
            onClick={onOpenReport}
            className="rounded-md border border-[#1c2942] bg-[#0d1526] px-3 py-1.5 text-xs font-semibold tracking-wider text-slate-300 transition-colors hover:border-cyan-500/40 hover:text-cyan-300"
          >
            + REPORT
          </button>
          <button
            onClick={onOpenDemo}
            className="rounded-md border border-purple-500/40 bg-purple-500/10 px-3 py-1.5 text-xs font-semibold tracking-wider text-purple-300 transition-colors hover:bg-purple-500/20"
          >
            🧠 MEMORY DEMO
          </button>
          <span
            className={`ml-1 hidden rounded border px-2 py-1 text-[10px] font-semibold tracking-wider md:inline ${
              hindsightAvailable
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-amber-500/30 bg-amber-500/10 text-amber-300"
            }`}
            title="Hindsight memory system status"
          >
            {hindsightAvailable === null ? "MEMORY…" : hindsightAvailable ? "HINDSIGHT ✓" : "HINDSIGHT OFFLINE"}
          </span>
        </div>
      </div>
    </header>
  );
}

function Stat({ label, value, accent }: { label: string; value?: number; accent: string }) {
  return (
    <div className="flex flex-col rounded-md border border-[#1c2942] bg-[#0a101c] px-3 py-1.5">
      <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500">{label}</span>
      <span className={`text-lg font-bold leading-tight ${accent}`}>{value ?? "–"}</span>
    </div>
  );
}
