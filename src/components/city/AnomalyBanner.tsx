"use client";

// LIVING CITY — anomaly banner (PHASE 10). OBSERVED FACT vs POSSIBLE EXPLANATION
// are visually separated. Investigate/Resolve actions are explicit operator decisions.

import { useCallback, useEffect, useState } from "react";
import { api, type AnomalyRow } from "@/lib/city-api";

export function AnomalyBanner({ cityId, refreshTick, onSelectEvent }: { cityId: string; refreshTick: number; onSelectEvent: (id: string) => void }) {
  const [anomalies, setAnomalies] = useState<AnomalyRow[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .anomalies(cityId)
      .then((r) => setAnomalies(r.anomalies.slice(0, 3)))
      .catch(() => undefined);
  }, [cityId]);

  useEffect(() => {
    load();
  }, [load, refreshTick]);

  if (anomalies.length === 0) return null;

  const act = async (id: string, action: "investigate" | "resolve") => {
    await api.anomalyAction(id, action).catch(() => undefined);
    load();
  };

  return (
    <div className="space-y-1.5">
      {anomalies.map((a) => (
        <div key={a.id} className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-amber-300">
              ⚠ ANOMALY · {a.metric}
            </span>
            <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-amber-100/90">{a.description}</p>
            <div className="flex gap-1.5">
              <button onClick={() => setExpanded(expanded === a.id ? null : a.id)} className="rounded border border-amber-500/30 px-2 py-1 text-[10px] font-semibold text-amber-300 hover:bg-amber-500/10">
                {expanded === a.id ? "Hide" : "Details"}
              </button>
              {a.status === "OPEN" && (
                <button onClick={() => act(a.id, "investigate")} className="rounded border border-cyan-500/30 px-2 py-1 text-[10px] font-semibold text-cyan-300 hover:bg-cyan-500/10">
                  Investigate
                </button>
              )}
              <button onClick={() => act(a.id, "resolve")} className="rounded border border-emerald-500/30 px-2 py-1 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500/10">
                Resolve
              </button>
            </div>
          </div>

          {expanded === a.id && (
            <div className="mt-2 space-y-2 border-t border-amber-500/15 pt-2">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-300/80">Observed facts</p>
                <ul className="mt-1 space-y-0.5">
                  {a.observedFacts.map((f, i) => (
                    <li key={i} className="text-[10px] text-slate-300">• {f}</li>
                  ))}
                </ul>
              </div>
              {a.possibleExplanation && (
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-sky-300/80">Possible explanation — not confirmed</p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-sky-100/80">{a.possibleExplanation}</p>
                </div>
              )}
              {a.memoryRecall?.memories && a.memoryRecall.memories.length > 0 && (
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-purple-300/80">🧠 Similar past experiences (Hindsight)</p>
                  {a.memoryRecall.memories.slice(0, 2).map((m) => (
                    <p key={m.id} className="mt-0.5 text-[10px] leading-relaxed text-purple-100/70">{m.text.slice(0, 180)}</p>
                  ))}
                </div>
              )}
              {a.related.length > 0 && (
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Events in the same window</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {a.related.map((e) => (
                      <button key={e.id} onClick={() => onSelectEvent(e.id)} className="rounded border border-[#1c2942] bg-[#0d1526] px-2 py-1 text-[10px] text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300">
                        {e.title.slice(0, 40)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
