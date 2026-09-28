"use client";

// Demo Dialog — BEFORE / AFTER MEMORY demonstration.
// Runs the REAL pipeline (ingest → recall → analyze → retain → recall again).
// The dialog narrates each step and shows the analysis differences honestly.

import { useState } from "react";
import { api } from "@/lib/city-api";

interface DemoStep {
  step: string;
  description: string;
  eventId?: string;
  analysis?: {
    summary: string;
    riskLevel: string;
    memoryUsed: boolean;
    memoryCount: number;
    degraded: boolean;
    recurringOutcomes: string[];
    similarPastSituations: number;
  } | null;
  outcomeRecorded?: string;
  retained?: boolean;
  error?: string;
}

interface DemoDialogProps {
  open: boolean;
  onClose: () => void;
  onFinished: () => void;
}

export function DemoDialog({ open, onClose, onFinished }: DemoDialogProps) {
  const [running, setRunning] = useState<"idle" | "seeding" | "demo">("idle");
  const [steps, setSteps] = useState<DemoStep[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const seed = async () => {
    setRunning("seeding");
    setError(null);
    try {
      await api.demoSeed();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning("idle");
    }
  };

  const runDemo = async () => {
    setRunning("demo");
    setSteps([]);
    setError(null);
    try {
      const res = await api.demoBeforeAfter();
      setSteps(res.steps ?? []);
      if (res.error) setError(res.error);
      onFinished();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning("idle");
    }
  };

  const analysisA = steps.find((s) => s.step === "analysis-a")?.analysis ?? null;
  const analysisB = steps.find((s) => s.step === "analysis-b")?.analysis ?? null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-label="Before and after memory demonstration">
      <div className="lc-scroll max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-[#1c2942] bg-[#0a101c] p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold tracking-[0.14em] text-slate-100">🧠 BEFORE / AFTER MEMORY</h2>
            <p className="mt-1 text-[12px] text-slate-400">
              A controlled demonstration of the memory loop — executed through the real Hindsight recall/retain pipeline.
              All demo events are clearly labeled <span className="font-bold text-purple-300">SIMULATED</span>.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300" aria-label="Close">✕</button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={seed}
            disabled={running !== "idle"}
            className="rounded border border-[#1c2942] bg-[#0d1526] px-3 py-2 text-[11px] font-bold tracking-wider text-slate-300 hover:border-cyan-500/40 disabled:opacity-40"
          >
            {running === "seeding" ? "Seeding…" : "1 · Seed historical memory (optional)"}
          </button>
          <button
            onClick={runDemo}
            disabled={running !== "idle"}
            className="rounded bg-purple-500/90 px-4 py-2 text-[11px] font-bold tracking-wider text-slate-950 hover:bg-purple-400 disabled:opacity-40"
          >
            {running === "demo" ? "Running demo — recall → analysis → retain → recall…" : "2 · Run before/after demo"}
          </button>
        </div>

        {running === "demo" && (
          <div className="mt-4 flex items-center gap-3 rounded border border-purple-500/30 bg-purple-500/5 px-4 py-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-purple-500/30 border-t-purple-400" />
            <p className="text-[12px] text-purple-200">
              Executing the real pipeline — Event A → outcome → Hindsight retain → Event B → Hindsight recall → comparison. This takes up to a couple of minutes (LLM + memory extraction).
            </p>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded border border-amber-500/30 bg-amber-500/5 px-4 py-3">
            <p className="text-[12px] font-medium text-amber-300">{error}</p>
            <p className="mt-1 text-[11px] text-amber-200/60">
              The demo refuses to fake results — it needs the real Hindsight memory system reachable.
            </p>
          </div>
        )}

        {steps.length > 0 && (
          <ol className="mt-4 space-y-2">
            {steps.map((s, i) => (
              <li key={i} className="rounded border border-[#141d31] bg-[#0d1526] px-4 py-3">
                <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-300">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-cyan-500/20 text-[9px]">{i + 1}</span>
                  {s.step.replaceAll("-", " ")}
                </p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-slate-200">{s.description}</p>
                {s.analysis && (
                  <div className="mt-2 grid gap-2 text-[11px] md:grid-cols-2">
                    <p className="text-slate-400">
                      <span className="text-slate-500">risk:</span>{" "}
                      <span className="font-bold text-slate-200">{s.analysis.riskLevel}</span>
                      {" · "}
                      <span className="text-slate-500">memories used:</span>{" "}
                      <span className="font-bold text-cyan-300">{s.analysis.memoryCount}</span>
                    </p>
                    {s.analysis.recurringOutcomes.length > 0 && (
                      <p className="text-slate-400">
                        <span className="text-slate-500">historically associated with:</span>{" "}
                        <span className="text-slate-200">{s.analysis.recurringOutcomes.slice(0, 2).join("; ")}</span>
                      </p>
                    )}
                  </div>
                )}
                {s.retained === false && (
                  <p className="mt-1 text-[11px] text-amber-300">⚠ Experience could not be retained to Hindsight.</p>
                )}
              </li>
            ))}
          </ol>
        )}

        {(analysisA || analysisB) && (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <CompareCard
              title="EVENT A — before memory"
              analysis={analysisA}
              tone="border-slate-600/40 bg-slate-500/5"
              accent="text-slate-300"
            />
            <CompareCard
              title="EVENT B — after memory"
              analysis={analysisB}
              tone="border-purple-500/40 bg-purple-500/5"
              accent="text-purple-300"
            />
          </div>
        )}

        <p className="mt-4 text-[10px] leading-relaxed text-slate-600">
          Honest framing: this system does not predict floods. It states what has historically been associated with similar
          conditions, and marks every demo event as SIMULATED. Differences between Event A and Event B come from actual
          Hindsight recall, not scripted text.
        </p>
      </div>
    </div>
  );
}

function CompareCard({
  title,
  analysis,
  tone,
  accent,
}: {
  title: string;
  analysis: DemoStep["analysis"];
  tone: string;
  accent: string;
}) {
  if (!analysis) return <div className={`rounded border ${tone} p-4`}><p className="text-[11px] text-slate-500">…</p></div>;
  return (
    <div className={`rounded border ${tone} p-4`}>
      <p className={`text-[10px] font-bold uppercase tracking-[0.18em] ${accent}`}>{title}</p>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-300">{analysis.summary}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="rounded bg-black/30 px-1.5 py-0.5 text-[9px] font-bold text-slate-300">RISK {analysis.riskLevel}</span>
        <span className="rounded bg-black/30 px-1.5 py-0.5 text-[9px] font-bold text-cyan-300">{analysis.memoryCount} memories</span>
        {analysis.degraded && <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">DEGRADED</span>}
      </div>
    </div>
  );
}
