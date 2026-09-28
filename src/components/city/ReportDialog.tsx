"use client";

// Report Dialog — operator incident reporting. User reports are clearly labeled
// USER-REPORTED end-to-end and run through the same memory pipeline.

import { useState } from "react";
import { api } from "@/lib/city-api";

const CATEGORIES = [
  { value: "WATERLOGGING", label: "💧 Water accumulation" },
  { value: "FLOODING_REPORT", label: "🌊 Flooding" },
  { value: "TRAFFIC_DISRUPTION", label: "🚦 Traffic slowdown" },
  { value: "ROAD_INCIDENT", label: "🚧 Road incident" },
  { value: "INFRASTRUCTURE", label: "🏗️ Infrastructure issue" },
  { value: "PUBLIC_SAFETY", label: "🚨 Public safety" },
  { value: "POWER_OUTAGE", label: "🔌 Power outage" },
  { value: "BUS_DELAY", label: "🚌 Bus delay" },
  { value: "USER_REPORT", label: "📋 Other" },
];

const ZONES = [
  { value: "west", label: "Western Corridor (Gachibowli · Kukatpally)", lat: 17.4401, lon: 78.3489 },
  { value: "central", label: "Central Hyderabad (Abids · Nampally)", lat: 17.3850, lon: 78.4867 },
  { value: "north", label: "North Hyderabad (Kompally · Alwal)", lat: 17.5400, lon: 78.4900 },
  { value: "east", label: "East Hyderabad (Uppal · Ghatkesar)", lat: 17.4000, lon: 78.5600 },
  { value: "oldcity", label: "Old City (Charminar · Falaknuma)", lat: 17.3616, lon: 78.4747 },
  { value: "secunderabad", label: "Secunderabad (Paradise · Tarnaka)", lat: 17.4399, lon: 78.4983 },
  { value: "south", label: "South Hyderabad (Shamshabad · Attapur)", lat: 17.2403, lon: 78.4294 },
];

interface ReportDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmitted: (eventId: string) => void;
}

export function ReportDialog({ open, onClose, onSubmitted }: ReportDialogProps) {
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("WATERLOGGING");
  const [zone, setZone] = useState("west");
  const [severity, setSeverity] = useState("MODERATE");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    const z = ZONES.find((x) => x.value === zone)!;
    try {
      const res = await api.report({
        description,
        category,
        latitude: z.lat,
        longitude: z.lon,
        locationName: z.label,
        severity,
      });
      setDescription("");
      onSubmitted(res.eventId);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const valid = description.trim().length >= 10;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Submit incident report">
      <div className="w-full max-w-lg rounded-lg border border-[#1c2942] bg-[#0a101c] p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-100">Operator Report</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300" aria-label="Close">✕</button>
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
          Your report will run through the full pipeline: validation → event → memory recall → analysis → memory retain.
        </p>

        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="rp-desc" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Description</label>
            <textarea
              id="rp-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="What are you observing? e.g. 'Water rising fast under the Raidurg metro underpass, two-wheelers slowing down.'"
              className="mt-1 w-full resize-none rounded border border-[#1c2942] bg-[#0d1526] p-2.5 text-[13px] text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/50 focus:outline-none"
            />
            <p className="mt-0.5 text-right text-[9px] text-slate-600">{description.length}/2000</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="rp-cat" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Category</label>
              <select
                id="rp-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded border border-[#1c2942] bg-[#0d1526] p-2 text-[12px] text-slate-200 focus:border-cyan-500/50 focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="rp-sev" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Severity</label>
              <select
                id="rp-sev"
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="mt-1 w-full rounded border border-[#1c2942] bg-[#0d1526] p-2 text-[12px] text-slate-200 focus:border-cyan-500/50 focus:outline-none"
              >
                {["MINOR", "MODERATE", "MAJOR", "CRITICAL"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="rp-zone" className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Location</label>
            <select
              id="rp-zone"
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              className="mt-1 w-full rounded border border-[#1c2942] bg-[#0d1526] p-2 text-[12px] text-slate-200 focus:border-cyan-500/50 focus:outline-none"
            >
              {ZONES.map((z) => (
                <option key={z.value} value={z.value}>{z.label}</option>
              ))}
            </select>
          </div>

          {error && (
            <p className="rounded border border-rose-500/30 bg-rose-500/10 p-2 text-[11px] text-rose-300">{error}</p>
          )}

          <div className="flex items-center justify-between">
            <span className="rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold tracking-wider text-amber-300">
              WILL BE LABELED USER-REPORTED
            </span>
            <button
              onClick={submit}
              disabled={!valid || submitting}
              className="rounded bg-cyan-500/90 px-4 py-2 text-xs font-bold tracking-wider text-slate-950 transition-colors hover:bg-cyan-400 disabled:opacity-40"
            >
              {submitting ? "Submitting…" : "Submit Report"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
