"use client";

// LIVING CITY — Operator city-state cards with PROVENANCE (LIVE / SIMULATED / NO_DATA).
// Values are derived from actual stored observations — never invented.

import { useEffect, useState } from "react";
import { api, type CityStateCard, type SimulatorStatus } from "@/lib/city-api";
import { ORIGIN_META } from "@/lib/city-format";

const CARD_PROVENANCE: Record<string, { label: string; badge: string }> = {
  LIVE: { label: "LIVE", badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  SIMULATED: { label: "SIMULATED", badge: "bg-purple-500/15 text-purple-300 border-purple-500/30" },
  USER_REPORTED: { label: "USER-REPORTED", badge: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  NO_DATA: { label: "NO DATA", badge: "bg-slate-500/10 text-slate-500 border-slate-500/25" },
};

const CARD_ICONS: Record<string, string> = {
  weather: "🌤️",
  air_quality: "😷",
  traffic: "🚦",
  transit: "🚌",
  grid: "🔌",
  hospital: "🏥",
};

export function CityStateStrip({
  cityId,
  refreshTick,
  onSimulatorChange,
}: {
  cityId: string;
  refreshTick: number;
  onSimulatorChange?: (s: SimulatorStatus) => void;
}) {
  const [cards, setCards] = useState<CityStateCard[]>([]);
  const [sim, setSim] = useState<SimulatorStatus | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .cityState(cityId)
      .then((r) => {
        if (!alive) return;
        setCards(r.cards);
        setSim(r.simulator);
        onSimulatorChange?.(r.simulator);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [cityId, refreshTick]);

  return (
    <div className="flex flex-wrap items-stretch gap-2">
      {cards.map((c) => {
        const p = CARD_PROVENANCE[c.provenance] ?? CARD_PROVENANCE.NO_DATA;
        return (
          <div
            key={c.key}
            title={c.note}
            className="min-w-[128px] flex-1 rounded-lg border border-[#1c2942] bg-[#0a101c] px-3 py-2"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">
                {CARD_ICONS[c.key] ?? "📊"} {c.label}
              </span>
              <span className={`rounded border px-1 py-0.5 text-[8px] font-bold tracking-wider ${p.badge}`}>{p.label}</span>
            </div>
            <p className={`mt-1 truncate text-[13px] font-semibold ${c.provenance === "NO_DATA" ? "text-slate-600" : "text-slate-200"}`}>
              {c.value}
            </p>
            <div className="mt-1.5 h-1 overflow-hidden rounded bg-[#141d31]">
              <div
                className={`h-full rounded transition-all duration-700 ${
                  c.provenance === "LIVE" ? "bg-emerald-500/70" : c.provenance === "SIMULATED" ? "bg-purple-500/70" : "bg-amber-500/70"
                }`}
                style={{ width: `${Math.round(Math.min(Math.max(c.level, 0.02), 1) * 100)}%` }}
              />
            </div>
          </div>
        );
      })}
      {sim?.running && (
        <div className="flex min-w-[128px] flex-1 items-center gap-2 rounded-lg border border-purple-500/30 bg-purple-500/5 px-3 py-2" title="Autonomous simulated incidents are running — all generated events are labeled SIMULATED">
          <span className="lc-live-dot !bg-purple-400 !shadow-purple-400" aria-hidden />
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-purple-300">City Pulse</p>
            <p className="text-[11px] text-purple-200/80">autonomous · {sim.runCount} runs</p>
          </div>
        </div>
      )}
    </div>
  );
}

export { ORIGIN_META };
