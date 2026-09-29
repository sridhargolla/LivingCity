"use client";

// LIVING CITY — Evidence panel (PHASE 4). Claim / source / timestamp / location /
// raw observation / event id — every item traces back to its stored origin.

import { useEffect, useState } from "react";
import { api, type EvidenceObject } from "@/lib/city-api";
import { ORIGIN_META, shortDate, shortTime } from "@/lib/city-format";

interface EvidenceDialogProps {
  open: boolean;
  eventId: string | null;
  cityId: string;
  onClose: () => void;
  onViewEvent: (id: string) => void;
  onFocusMap: (id: string) => void;
}

export function EvidenceDialog({ open, eventId, cityId, onClose, onViewEvent, onFocusMap }: EvidenceDialogProps) {
  const [items, setItems] = useState<EvidenceObject[]>([]);
  const [loading, setLoading] = useState(false);
  const [origin, setOrigin] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    let alive = true;
    const run = async () => {
      setLoading(true);
      try {
        if (eventId) {
          const r = await api.events({ limit: 100 });
          if (!alive) return;
          const ev = r.events.find((e) => e.id === eventId);
          setItems(ev ? [eventToEvidence(ev)] : []);
        } else {
          const r = await api.evidence({ cityId, origin: origin || undefined, limit: 40 });
          if (!alive) return;
          setItems(r.evidence);
        }
      } catch {
        if (alive) setItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    };
    const t = setTimeout(run, 0);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [open, eventId, cityId, origin]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Evidence">
      <div className="lc-scroll max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-[#1c2942] bg-[#0a101c] shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-[#1c2942] bg-[#0a101c] px-4 py-3">
          <h2 className="text-sm font-bold tracking-wider text-slate-100">🧾 EVIDENCE</h2>
          <button onClick={onClose} className="rounded border border-[#1c2942] px-2 py-1 text-[10px] uppercase tracking-wider text-slate-500 hover:text-slate-300">
            ✕ Close
          </button>
        </div>

        <div className="px-4 py-3">
          {!eventId && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {["", "LIVE", "USER_REPORTED", "SIMULATED"].map((o) => (
                <button
                  key={o || "all"}
                  onClick={() => setOrigin(o)}
                  className={`rounded border px-2 py-1 text-[10px] font-semibold tracking-wider ${
                    origin === o ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300" : "border-[#1c2942] text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {o === "" ? "ALL" : (ORIGIN_META[o]?.label ?? o)}
                </button>
              ))}
            </div>
          )}

          {loading && <p className="py-8 text-center text-xs text-slate-500">Gathering evidence…</p>}
          {!loading && items.length === 0 && (
            <div className="py-10 text-center">
              <p className="text-sm text-slate-400">I don&apos;t have verified evidence for that.</p>
              <p className="mt-1 text-[11px] text-slate-600">Evidence is only produced from stored observations — never generated.</p>
            </div>
          )}

          <div className="space-y-2.5">
            {items.map((ev) => (
              <article key={`${ev.event_id}-${ev.observed_at}`} className="rounded-lg border border-[#141d31] bg-[#0d1526] p-3">
                <div className="flex items-center gap-2">
                  <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold tracking-wider ${ORIGIN_META[ev.data_origin]?.badge ?? ""}`}>
                    {ORIGIN_META[ev.data_origin]?.label ?? ev.data_origin}
                  </span>
                  <span className="text-[10px] text-slate-500">{ev.sourceName}</span>
                </div>
                <p className="mt-2 text-[12px] leading-relaxed text-slate-200">
                  <span className="font-semibold text-slate-400">Claim: </span>
                  {ev.claim}
                </p>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                  <ERow label="Source" value={ev.source} />
                  <ERow label="Observed" value={`${shortDate(ev.observed_at)} ${shortTime(ev.observed_at)} IST`} />
                  <ERow label="Location" value={ev.location} />
                  <ERow label="Event ID" value={ev.event_id.slice(0, 14) + "…"} mono />
                </dl>
                {Object.keys(ev.raw).length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300">
                      Show raw observation
                    </summary>
                    <pre className="lc-scroll mt-1.5 max-h-32 overflow-auto rounded border border-[#141d31] bg-[#080d18] p-2 text-[10px] leading-relaxed text-slate-400">
                      {JSON.stringify(ev.raw, null, 2)}
                    </pre>
                  </details>
                )}
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <button onClick={() => onViewEvent(ev.event_id)} className="rounded border border-[#1c2942] bg-[#080d18] px-2 py-1 text-[10px] font-semibold text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300">
                    View event
                  </button>
                  <button onClick={() => onFocusMap(ev.event_id)} className="rounded border border-[#1c2942] bg-[#080d18] px-2 py-1 text-[10px] font-semibold text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300">
                    View on map
                  </button>
                  {ev.source_url && (
                    <a
                      href={ev.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded border border-[#1c2942] bg-[#080d18] px-2 py-1 text-[10px] font-semibold text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300"
                    >
                      Open source ↗
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ERow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="shrink-0 font-bold uppercase tracking-wider text-slate-600">{label}</dt>
      <dd className={`truncate text-slate-300 ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}

/** Local adapter: build evidence-shaped object from a PublicEvent (display only). */
function eventToEvidence(e: {
  id: string;
  source: string;
  dataOrigin: string;
  title: string;
  description: string;
  locationName: string;
  latitude: number | null;
  longitude: number | null;
  observedAt: string;
}): EvidenceObject {
  const SOURCE_NAMES: Record<string, string> = {
    "open-meteo": "Open-Meteo Forecast API",
    "open-meteo-air-quality": "Open-Meteo Air Quality API (CAMS)",
    "wttr.in": "wttr.in weather service",
    openweather: "OpenWeather API",
    "report-portal": "City operator report",
    "demo-scenarios": "Built-in simulation engine",
    simulator: "Built-in simulation engine",
  };
  const SOURCE_URLS: Record<string, string> = {
    "open-meteo": "https://open-meteo.com/",
    "open-meteo-air-quality": "https://open-meteo.com/en/docs/air-quality-api",
    "wttr.in": "https://wttr.in",
    openweather: "https://openweathermap.org/api",
  };
  return {
    claim: e.title + (e.description ? ` — ${e.description.slice(0, 240)}` : ""),
    source: e.source,
    sourceName: SOURCE_NAMES[e.source] ?? e.source,
    observed_at: e.observedAt,
    location: e.locationName,
    data_origin: (["LIVE", "USER_REPORTED", "SIMULATED"].includes(e.dataOrigin) ? e.dataOrigin : "LIVE") as EvidenceObject["data_origin"],
    event_id: e.id,
    source_url: SOURCE_URLS[e.source] ?? null,
    coordinates: e.latitude !== null && e.longitude !== null ? { lat: e.latitude, lon: e.longitude } : null,
    raw: {},
  };
}
