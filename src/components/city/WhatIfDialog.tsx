"use client";

// LIVING CITY — What-If scenario dialog (PHASE 13).
// OBSERVED / HISTORICAL / SCENARIO labels on every consideration. Never a prediction.

import { useState } from "react";
import { api, type ScenarioResult } from "@/lib/city-api";
import { EVENT_ICONS } from "@/lib/city-format";

interface WhatIfDialogProps {
  open: boolean;
  cityId: string;
  cityName: string;
  eventId: string | null;
  eventTitle: string | null;
  onClose: () => void;
}

const PRESETS = [
  "What if this rainfall continues for another hour?",
  "What if the transit disruption spreads to connecting routes?",
  "What should we monitor over the next 6 hours?",
];

const LABEL_STYLES: Record<string, string> = {
  OBSERVED: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  HISTORICAL: "border-purple-500/40 bg-purple-500/10 text-purple-300",
  SCENARIO: "border-sky-500/40 bg-sky-500/10 text-sky-300",
};

export function WhatIfDialog({ open, cityId, cityName, eventId, eventTitle, onClose }: WhatIfDialogProps) {
  const [question, setQuestion] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const run = async (q: string) => {
    const question = q.trim();
    if (question.length < 5 || running) return;
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const r = await api.scenario(cityId, question, eventId);
      setResult(r.scenario);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scenario analysis failed.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="What-if scenario">
      <div className="lc-scroll max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-lg border border-[#1c2942] bg-[#0a101c] shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-[#1c2942] bg-[#0a101c] px-4 py-3">
          <h2 className="text-sm font-bold tracking-wider text-slate-100">⚡ WHAT-IF — {cityName}</h2>
          <button onClick={onClose} className="rounded border border-[#1c2942] px-2 py-1 text-[10px] uppercase tracking-wider text-slate-500 hover:text-slate-300">
            ✕ Close
          </button>
        </div>

        <div className="px-4 py-3">
          {eventTitle && (
            <p className="mb-2 rounded border border-[#141d31] bg-[#0d1526] px-2.5 py-1.5 text-[11px] text-slate-400">
              Context event: <span className="text-slate-200">{EVENT_ICONS.WEATHER_RAIN ?? ""} {eventTitle}</span>
            </p>
          )}
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={2}
            placeholder="What if…? (scenario analysis — not a prediction)"
            className="w-full resize-none rounded border border-[#1c2942] bg-[#0d1526] px-3 py-2 text-[12px] text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/40 focus:outline-none"
            aria-label="Scenario question"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button key={p} onClick={() => { setQuestion(p); run(p); }} className="rounded-full border border-[#1c2942] bg-[#0d1526] px-2.5 py-1 text-[10px] text-slate-400 hover:border-cyan-500/40 hover:text-cyan-300">
                {p}
              </button>
            ))}
          </div>
          <button
            onClick={() => run(question)}
            disabled={running || question.trim().length < 5}
            className="mt-2.5 w-full rounded border border-cyan-500/40 bg-cyan-500/15 px-3 py-2 text-xs font-bold tracking-wider text-cyan-200 hover:bg-cyan-500/25 disabled:opacity-40"
          >
            {running ? "ANALYZING SCENARIO…" : "RUN SCENARIO"}
          </button>

          {error && <p className="mt-2 rounded border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[11px] text-rose-300">{error}</p>}

          {result && (
            <div className="mt-3">
              <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-slate-500">Scenario</p>
              <p className="mt-1 text-[12px] leading-relaxed text-slate-200">{result.summary}</p>
              {result.memoryUsed && (
                <span className="mt-1.5 inline-block rounded border border-purple-500/30 bg-purple-500/10 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-purple-300">
                  🧠 {result.memoryCount} HINDSIGHT MEMORIES INFORMED THIS
                </span>
              )}
              {result.degraded && (
                <span className="mt-1.5 ml-1 inline-block rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-amber-300">
                  DEGRADED MODE
                </span>
              )}
              <div className="mt-2.5 space-y-1.5">
                {result.considerations.map((c, i) => (
                  <div key={i} className="rounded border border-[#141d31] bg-[#0d1526] px-2.5 py-2">
                    <span className={`rounded border px-1.5 py-0.5 text-[8px] font-bold tracking-wider ${LABEL_STYLES[c.label]}`}>
                      {c.label}
                    </span>
                    <p className="mt-1 text-[11px] leading-relaxed text-slate-300">{c.text}</p>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-slate-600">
                These are scenario considerations based on current conditions and city memory — not guaranteed outcomes.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
