"use client";

// LIVING CITY — City Learning dashboard (PHASE 11).
// Every insight is traceable to underlying memories, events, or human feedback.

import { useCallback, useEffect, useState } from "react";
import { api, type CityLearning } from "@/lib/city-api";
import { shortDate } from "@/lib/city-format";

export function LearningPanel({
  cityId,
  refreshTick,
  onSelectEvent,
  onOpenMemoryGraph,
}: {
  cityId: string;
  refreshTick: number;
  onSelectEvent: (id: string) => void;
  onOpenMemoryGraph: () => void;
}) {
  const [learning, setLearning] = useState<CityLearning | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .learning(cityId)
      .then(setLearning)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load city learning."));
  }, [cityId]);

  useEffect(() => {
    load();
  }, [load, refreshTick]);

  if (error) return <p className="rounded border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">{error}</p>;
  if (!learning) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400" />
      </div>
    );
  }

  return (
    <div className="lc-scroll space-y-4 overflow-y-auto" style={{ maxHeight: 560 }}>
      {/* headline stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="Significant events (30d)" value={learning.significantEvents} accent="text-rose-300" />
        <Stat label="Similar historical experiences" value={learning.similarHistoricalExperiences} accent="text-cyan-300" />
        <Stat label="Recurring patterns" value={learning.recurringPatterns} accent="text-purple-300" />
        <Stat label="Confirmed lessons" value={learning.confirmedLessons} accent="text-emerald-300" />
        <Stat label="Retained experiences" value={learning.retainedExperiences} accent="text-slate-200" />
        <Stat label="Unresolved questions" value={learning.unresolvedQuestions.length} accent="text-amber-300" />
      </div>

      {/* patterns */}
      <Section title="Recurring Patterns" action={{ label: "Open memory graph", onClick: onOpenMemoryGraph }}>
        {learning.topPatterns.length === 0 ? (
          <Empty text="No recurring patterns established yet." />
        ) : (
          learning.topPatterns.map((p) => (
            <div key={p.id} className="rounded border border-[#141d31] bg-[#0d1526] px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300">pattern · {p.basis}</span>
                <span className="text-[10px] text-slate-600">{Math.round(p.confidence * 100)}%</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-300">{p.explanation}</p>
              <p className="mt-0.5 text-[10px] text-slate-600">{p.from} → {p.to}</p>
            </div>
          ))
        )}
      </Section>

      {/* lessons */}
      <Section title="Human-Confirmed Lessons">
        {learning.lessons.length === 0 ? (
          <Empty text="No human-confirmed lessons yet — confirm or reject AI observations to build verified lessons." />
        ) : (
          learning.lessons.map((l) => (
            <button
              key={l.id}
              onClick={() => onSelectEvent(l.eventId)}
              className="block w-full rounded border border-[#141d31] bg-[#0d1526] px-3 py-2 text-left hover:border-cyan-500/30"
            >
              <div className="flex items-center gap-2">
                <span className={`rounded border px-1 py-0.5 text-[8px] font-bold tracking-wider ${l.verdict === "CONFIRMED" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-rose-500/40 bg-rose-500/10 text-rose-300"}`}>
                  {l.verdict}
                </span>
                {l.retained && <span className="text-[9px] text-slate-500">🧠 retained to memory</span>}
                <span className="ml-auto text-[9px] text-slate-600">{shortDate(l.createdAt)}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-300">{l.observation}</p>
              {l.note && <p className="mt-0.5 text-[10px] text-slate-600">“{l.note}”</p>}
            </button>
          ))
        )}
      </Section>

      {/* unresolved questions */}
      <Section title="Unresolved Questions">
        {learning.unresolvedQuestions.length === 0 ? (
          <Empty text="No open questions — all observed signals are explained or resolved." />
        ) : (
          learning.unresolvedQuestions.map((q) => (
            <div key={q.id} className="rounded border border-amber-500/25 bg-amber-500/5 px-3 py-2">
              <span className="text-[9px] font-bold uppercase tracking-wider text-amber-300">{q.kind}</span>
              <p className="mt-1 text-[11px] leading-relaxed text-amber-100/80">{q.text}</p>
            </div>
          ))
        )}
      </Section>

      {/* recent retained memories */}
      <Section title="Recently Retained Experiences">
        {learning.recentMemories.length === 0 ? (
          <Empty text="Nothing retained yet." />
        ) : (
          learning.recentMemories.map((m) => (
            <button
              key={m.id}
              onClick={() => m.eventId && m.eventId !== "copilot" && onSelectEvent(m.eventId)}
              className="block w-full rounded border border-[#141d31] bg-[#0d1526] px-3 py-2 text-left hover:border-cyan-500/30"
            >
              <p className="line-clamp-2 text-[11px] leading-relaxed text-slate-300">{m.preview}</p>
              <p className="mt-0.5 text-[9px] text-slate-600">{shortDate(m.createdAt)}</p>
            </button>
          ))
        )}
      </Section>

      <p className="text-[10px] text-slate-700">Generated {shortDate(learning.generatedAt)} · every number links to stored records</p>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-lg border border-[#1c2942] bg-[#0a101c] px-3 py-2">
      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className={`text-xl font-bold ${accent}`}>{value}</p>
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: { label: string; onClick: () => void }; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-1.5 flex items-center justify-between">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-300">{title}</h3>
        {action && (
          <button onClick={action.onClick} className="text-[10px] font-semibold text-cyan-400 hover:text-cyan-300">
            {action.label} →
          </button>
        )}
      </div>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded border border-dashed border-[#1c2942] px-3 py-2.5 text-[11px] text-slate-600">{text}</p>;
}
