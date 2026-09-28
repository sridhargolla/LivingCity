"use client";

import { useEffect, useState } from "react";
import { api, type MemoryExperience, type PublicEvent } from "@/lib/city-api";
import { EVENT_ICONS, ORIGIN_META, RISK_COLORS, SEVERITY_COLORS, shortDate, shortTime, timeAgo } from "@/lib/city-format";

interface EventDetailPanelProps {
  eventId: string;
  events: PublicEvent[];
  onSelect: (id: string) => void;
  onClose: () => void;
  refreshTick: number;
  onRunWhatIf?: (eventId: string) => void;
  onShowEvidence?: (eventId: string) => void;
}

export function EventDetailPanel({ eventId, events, onSelect, onClose, refreshTick, onRunWhatIf, onShowEvidence }: EventDetailPanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Awaited<ReturnType<typeof api.event>> | null>(null);
  const [memory, setMemory] = useState<Awaited<ReturnType<typeof api.eventMemory>> | null>(null);
  const [memoryLoading, setMemoryLoading] = useState(true);
  const [feedbackState, setFeedbackState] = useState<{ verdict: string; retained: boolean } | null>(null);
  const [feedbackBusy, setFeedbackBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [d, m] = await Promise.all([api.event(eventId), api.eventMemory(eventId)]);
        if (!alive) return;
        setData(d);
        setMemory(m);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (alive) {
          setLoading(false);
          setMemoryLoading(false);
        }
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [eventId, refreshTick]);

  // reset local feedback state when the event changes
  useEffect(() => {
    setFeedbackState(null);
  }, [eventId]);

  const submitFeedback = async (verdict: string) => {
    if (feedbackBusy || !data?.event) return;
    setFeedbackBusy(true);
    try {
      const r = await api.feedback(eventId, {
        verdict,
        observation: data.analysis?.summary ?? data.event.title,
      });
      setFeedbackState({ verdict, retained: r.retainedToMemory });
    } catch {
      setFeedbackState({ verdict, retained: false });
    } finally {
      setFeedbackBusy(false);
    }
  };

  // transferred experience (cross-city learning) surfaced from the analysis payload
  const transferred = (data?.analysis as unknown as { transferred?: { cityName: string; text: string } | null })?.transferred ?? null;

  const event = data?.event;
  const analysis = data?.analysis;

  return (
    <section className="lc-scroll flex min-h-0 flex-1 flex-col overflow-y-auto rounded-lg border border-[#1c2942] bg-[#0a101c]">
      {loading && (
        <div className="flex h-48 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400" />
        </div>
      )}
      {error && !loading && (
        <div className="p-6 text-center">
          <p className="text-sm text-rose-300">Could not load event.</p>
          <p className="mt-1 text-xs text-slate-500">{error}</p>
        </div>
      )}
      {event && !loading && (
        <>
          <div className="border-b border-[#1c2942] px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg" aria-hidden>{EVENT_ICONS[event.eventType] ?? "📍"}</span>
                  <h2 className="truncate text-sm font-bold tracking-wide text-slate-100">{event.title}</h2>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">{event.locationName}</p>
              </div>
              <button
                onClick={onClose}
                className="shrink-0 rounded border border-[#1c2942] px-2 py-1 text-[10px] uppercase tracking-wider text-slate-500 hover:text-slate-300"
              >
                ✕
              </button>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
              <Row label="Source" value={event.source} />
              <Row
                label="Origin"
                value={ORIGIN_META[event.dataOrigin]?.label ?? event.dataOrigin}
                valueClass={ORIGIN_META[event.dataOrigin]?.badge}
              />
              <Row label="Observed" value={`${shortDate(event.observedAt)} ${shortTime(event.observedAt)} IST`} />
              <Row label="Severity" value={event.severity} valueClass={`text-[${SEVERITY_COLORS[event.severity]}]`} />
              <Row label="Status" value={event.status} />
              <Row label="Confidence" value={`${Math.round(event.confidence * 100)}%`} />
            </dl>

            {event.description && (
              <p className="mt-3 rounded border border-[#141d31] bg-[#0d1526] p-2.5 text-[12px] leading-relaxed text-slate-300">
                {event.description}
              </p>
            )}
          </div>

          {/* ── CITY MEMORY (Hindsight recall, visible) ── */}
          <div className="border-b border-[#1c2942] px-4 py-3">
            <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-300">
              🧠 City Memory
              {memory?.memoryStatus === "AVAILABLE" && (
                <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-[10px] tracking-wider text-cyan-300">
                  {memory.recalled.length} related experience{memory.recalled.length === 1 ? "" : "s"}
                </span>
              )}
            </h3>

            {memoryLoading ? (
              <p className="mt-2 text-[11px] text-slate-500">Querying Hindsight…</p>
            ) : memory?.memoryStatus === "UNAVAILABLE" ? (
              <div className="mt-2 rounded border border-amber-500/30 bg-amber-500/5 p-2.5">
                <p className="text-[11px] font-medium text-amber-300">Hindsight memory temporarily unavailable.</p>
                <p className="mt-1 text-[10px] text-amber-200/60">
                  The system continues in degraded mode — no memory claims are made.
                </p>
              </div>
            ) : memory && memory.recalled.length === 0 ? (
              <p className="mt-2 text-[11px] text-slate-500">
                No related experiences in city memory yet — this situation has no historical precedent.
              </p>
            ) : (
              memory && (
                <div className="mt-2 space-y-1.5">
                  {memory.recalled.slice(0, 5).map((m: MemoryExperience) => (
                    <div
                      key={m.id}
                      className="rounded border border-[#141d31] bg-[#0d1526] px-2.5 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400/80">
                          {m.type ?? "memory"} · {m.occurredStart ? shortDate(m.occurredStart) : "undated"}
                        </span>
                        {m.score != null && (
                          <span className="text-[10px] text-slate-600">match {(m.score * 100).toFixed(0)}%</span>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-300">{m.text}</p>
                    </div>
                  ))}
                </div>
              )
            )}

            {memory?.retainedFact && (
              <div className="mt-2 rounded border border-emerald-500/25 bg-emerald-500/5 p-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Memory updated</p>
                <p className="mt-1 text-[11px] leading-relaxed text-emerald-100/80">{memory.retainedFact}</p>
              </div>
            )}
          </div>

          {/* ── AI EXPLANATION ── */}
          <div className="border-b border-[#1c2942] px-4 py-3">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-300">Agent Assessment</h3>
            {!analysis ? (
              <p className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
                <span className="h-3 w-3 animate-spin rounded-full border border-slate-600 border-t-cyan-400" />
                Analysis running…
              </p>
            ) : (
              <>
                <div className="mt-2 flex items-center gap-2">
                  <span
                    className="rounded px-2 py-0.5 text-[10px] font-bold tracking-wider text-slate-950"
                    style={{ background: RISK_COLORS[analysis.riskLevel] ?? "#64748b" }}
                  >
                    RISK: {analysis.riskLevel}
                  </span>
                  {analysis.degraded && (
                    <span className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-amber-300">
                      DEGRADED MODE
                    </span>
                  )}
                  <span className="text-[10px] text-slate-500">
                    {analysis.memoryCount} memories used{analysis.memoryUsed ? "" : " · no memory basis"}
                  </span>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-slate-200">{analysis.summary}</p>

                {transferred && (
                  <div className="mt-2 rounded border border-sky-500/30 bg-sky-500/5 p-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-sky-300">
                      ⟶ Transferred experience · {transferred.cityName}
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-sky-100/80">{transferred.text}</p>
                    <p className="mt-1 text-[9px] uppercase tracking-wider text-sky-300/60">
                      Cross-city insight — not local evidence. Local observations remain authoritative.
                    </p>
                  </div>
                )}

                {analysis.risks.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Possible risks</p>
                    <ul className="mt-1 list-inside list-disc space-y-0.5 text-[11px] text-slate-300">
                      {analysis.risks.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {analysis.recommendations.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Recommendations</p>
                    <ul className="mt-1 list-inside list-disc space-y-0.5 text-[11px] text-slate-300">
                      {analysis.recommendations.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* ── HUMAN FEEDBACK (PHASE 12) ── */}
                <div className="mt-3 rounded border border-[#141d31] bg-[#080d18] px-2.5 py-2">
                  {feedbackState ? (
                    <p className="text-[11px] text-slate-300">
                      <span className="font-semibold text-slate-100">Recorded: {feedbackState.verdict}</span>
                      {feedbackState.retained && " · 🧠 retained to city memory (tagged human feedback)"}
                      {!feedbackState.retained && (feedbackState.verdict === "CONFIRMED" || feedbackState.verdict === "REJECTED") && " · city memory unavailable — feedback stored locally"}
                    </p>
                  ) : (
                    <>
                      <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">Your judgment — is this assessment sound?</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <FeedbackButton label="✓ Confirm" onClick={() => submitFeedback("CONFIRMED")} disabled={feedbackBusy} accent="emerald" />
                        <FeedbackButton label="✕ Reject" onClick={() => submitFeedback("REJECTED")} disabled={feedbackBusy} accent="rose" />
                        <FeedbackButton label="🔍 Investigate" onClick={() => submitFeedback("INVESTIGATE")} disabled={feedbackBusy} accent="cyan" />
                        <FeedbackButton label="✕ Dismiss" onClick={() => submitFeedback("DISMISSED")} disabled={feedbackBusy} accent="slate" />
                      </div>
                      <p className="mt-1 text-[9px] leading-relaxed text-slate-600">
                        Confirm/Reject are retained into city memory so future analyses respect human judgment.
                      </p>
                    </>
                  )}
                </div>

                {/* ── EVIDENCE + WHAT-IF ACTIONS ── */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {onShowEvidence && (
                    <button
                      onClick={() => onShowEvidence(eventId)}
                      className="rounded border border-cyan-500/30 bg-cyan-500/5 px-2 py-1 text-[10px] font-semibold tracking-wider text-cyan-300 hover:bg-cyan-500/15"
                    >
                      🧾 Evidence
                    </button>
                  )}
                  {onRunWhatIf && (
                    <button
                      onClick={() => onRunWhatIf(eventId)}
                      className="rounded border border-sky-500/30 bg-sky-500/5 px-2 py-1 text-[10px] font-semibold tracking-wider text-sky-300 hover:bg-sky-500/15"
                    >
                      ⚡ What-if
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ── OUTCOMES ── */}
          {data && data.outcomes.length > 0 && (
            <div className="border-b border-[#1c2942] px-4 py-3">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-300">Observed Outcomes</h3>
              <div className="mt-2 space-y-1.5">
                {data.outcomes.map((o) => (
                  <div key={o.id} className="rounded border border-[#141d31] bg-[#0d1526] px-2.5 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400/80">{o.outcomeType}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-300">{o.description}</p>
                    <p className="mt-0.5 text-[10px] text-slate-600">{timeAgo(o.createdAt)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── RELATED EVENTS ── */}
          {memory && memory.recalled.length === 0 && null}
          <RelatedEvents eventId={eventId} onSelect={onSelect} refreshTick={refreshTick} />
        </>
      )}
    </section>
  );
}

function Row({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="shrink-0 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</dt>
      <dd className={`truncate text-slate-300 ${valueClass ?? ""}`}>{value}</dd>
    </div>
  );
}

const FEEDBACK_ACCENTS: Record<string, string> = {
  emerald: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20",
  rose: "border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20",
  cyan: "border-cyan-500/40 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20",
  slate: "border-[#1c2942] bg-transparent text-slate-400 hover:text-slate-200",
};

function FeedbackButton({ label, onClick, disabled, accent }: { label: string; onClick: () => void; disabled: boolean; accent: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded border px-2 py-1 text-[10px] font-semibold tracking-wider transition-colors disabled:opacity-40 ${FEEDBACK_ACCENTS[accent] ?? FEEDBACK_ACCENTS.slate}`}
    >
      {label}
    </button>
  );
}

function RelatedEvents({
  eventId,
  onSelect,
  refreshTick,
}: {
  eventId: string;
  onSelect: (id: string) => void;
  refreshTick: number;
}) {
  const [edges, setEdges] = useState<Awaited<ReturnType<typeof api.eventRelationships>>["edges"] | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .eventRelationships(eventId)
      .then((r) => alive && setEdges(r.edges))
      .catch(() => alive && setEdges([]));
    return () => {
      alive = false;
    };
  }, [eventId, refreshTick]);

  if (!edges || edges.length === 0) return null;

  return (
    <div className="px-4 py-3">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-300">Linked Events</h3>
      <div className="mt-2 space-y-1.5">
        {edges.slice(0, 6).map((edge) => (
          <button
            key={edge.id}
            onClick={() => onSelect(edge.other.id)}
            className="flex w-full items-center gap-2 rounded border border-[#141d31] bg-[#0d1526] px-2.5 py-2 text-left hover:border-cyan-500/30"
          >
            <span className="text-[10px] font-bold tracking-wider" style={{ color: "#94a3b8" }}>
              {edge.direction === "outgoing" ? "→" : "←"}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11px] text-slate-200">{edge.other.title}</span>
              <span className="block text-[10px] text-slate-500">{edge.relation.replaceAll("_", " ").toLowerCase()}</span>
            </span>
            <span className="text-[10px] text-slate-600">{Math.round(edge.confidence * 100)}%</span>
          </button>
        ))}
      </div>
    </div>
  );
}
