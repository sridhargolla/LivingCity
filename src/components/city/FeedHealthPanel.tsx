"use client";

// Feed Health Panel — statuses come from REAL feed runs (feed_runs table + live state).

import { useEffect, useState } from "react";
import { api, type FeedStatus } from "@/lib/city-api";
import { shortTime, timeAgo } from "@/lib/city-format";

const FEED_LABELS: Record<string, string> = {
  "open-meteo": "Weather · Open-Meteo",
  "open-meteo-air-quality": "Air Quality · Open-Meteo",
  "wttr-in": "Weather · wttr.in (fallback)",
  openweather: "Weather · OpenWeather (key)",
  "report-portal": "Operator Reports",
  "demo-scenarios": "Demo Scenarios",
};

const STATUS_STYLES: Record<string, { dot: string; text: string }> = {
  HEALTHY: { dot: "bg-emerald-400", text: "text-emerald-300" },
  DEGRADED: { dot: "bg-amber-400", text: "text-amber-300" },
  FAILED: { dot: "bg-rose-400", text: "text-rose-300" },
  DORMANT: { dot: "bg-slate-500", text: "text-slate-400" },
};

export function FeedHealthPanel({ refreshTick }: { refreshTick: number }) {
  const [feeds, setFeeds] = useState<FeedStatus[] | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .feeds()
      .then((f) => alive && setFeeds(f.feeds))
      .catch(() => alive && setFeeds([]));
    return () => {
      alive = false;
    };
  }, [refreshTick]);

  return (
    <section className="rounded-lg border border-[#1c2942] bg-[#0a101c]">
      <div className="border-b border-[#1c2942] px-4 py-2.5">
        <h2 className="text-xs font-bold uppercase tracking-[0.22em] text-slate-300">Data Sources</h2>
      </div>
      <ul className="divide-y divide-[#141d31] px-4">
        {(feeds ?? []).map((f) => {
          const st = STATUS_STYLES[f.status] ?? STATUS_STYLES.DORMANT;
          return (
            <li key={f.feedId} className="flex items-center gap-3 py-2.5">
              <span className={`h-2 w-2 shrink-0 rounded-full ${st.dot}`} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium text-slate-200">{FEED_LABELS[f.feedId] ?? f.feedId}</p>
                <p className="truncate text-[10px] text-slate-500" title={f.lastError ?? f.note}>
                  {f.lastError ? f.lastError : f.note}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className={`text-[10px] font-bold uppercase tracking-wider ${st.text}`}>{f.status}</p>
                {f.lastRunAt && <p className="text-[9px] text-slate-600">{timeAgo(f.lastRunAt)}</p>}
              </div>
            </li>
          );
        })}
        {feeds?.length === 0 && <li className="py-3 text-[11px] text-slate-500">No feed data yet.</li>}
      </ul>
    </section>
  );
}
