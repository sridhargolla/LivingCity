"use client";

// LIVING CITY — Settings: city registry, data-source health (real feed status),
// AI + Hindsight configuration, privacy controls, notifications.

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { api } from "@/lib/city-api";
import { useAppStore } from "@/lib/store";
import { usePoll } from "@/hooks/usePoll";
import { timeAgo } from "@/lib/city-format";
import { PageHeader, Panel, LoadingBlock, ErrorBlock, StatusPill } from "@/components/pages/shared";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const FEED_CLS: Record<string, string> = {
  HEALTHY: "text-emerald-300",
  DEGRADED: "text-amber-300",
  FAILED: "text-rose-300",
  DORMANT: "text-slate-400",
};

export function SettingsPage() {
  const cityId = useAppStore((s) => s.cityId);
  const setCityId = useAppStore((s) => s.setCityId);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const settings = usePoll(() => api.settings(), 120_000, []);
  const d = settings.data;

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 4000);
    return () => clearTimeout(t);
  }, [note]);

  const patch = async (body: Parameters<typeof api.updateSettings>[0], msg: string) => {
    setBusy(true);
    try {
      await api.updateSettings(body);
      setNote(msg);
      settings.refresh();
    } catch {
      setNote("Failed to save setting.");
    } finally {
      setBusy(false);
    }
  };

  const alertsEnabled = typeof window !== "undefined" && localStorage.getItem("lc-browser-alerts") === "1";

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader title="Settings" subtitle="City, data sources, AI, memory, privacy and notifications" />

      {note && (
        <div role="status" className="rounded border border-cyan-500/40 bg-cyan-500/5 px-3 py-2 text-[11px] text-cyan-200">
          {note}
        </div>
      )}

      {settings.loading && !d ? (
        <Panel>
          <LoadingBlock label="Loading settings…" />
        </Panel>
      ) : settings.error && !d ? (
        <Panel title="Settings">
          <ErrorBlock message={settings.error} />
        </Panel>
      ) : d ? (
        <>
          {/* City */}
          <Panel title="City" right={<span className="text-[10px] text-slate-500">multi-city · each city owns its data and memory bank</span>}>
            <ul className="flex flex-col gap-2">
              {d.cities.map((c) => (
                <li
                  key={c.cityId}
                  className={cn(
                    "flex flex-wrap items-center gap-3 rounded border px-3 py-2.5 text-[11px]",
                    c.cityId === d.activeCityId ? "border-cyan-500/40 bg-cyan-500/5" : "border-[#1c2942] bg-[#070d18]"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-100">
                      {c.name} <span className="font-normal text-slate-500">· {c.country} · {c.timezone}</span>
                      {c.primary && <span className="ml-2 rounded bg-white/5 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-slate-400">primary</span>}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {c.latitude.toFixed(3)}, {c.longitude.toFixed(3)} · {c.storedEvents} stored events · providers:{" "}
                      {(["weather", "airQuality", "traffic", "transit"] as const).map((p) => (
                        <span key={p} className={cn("mr-1.5", c.providers[p] ? "text-emerald-300" : "text-slate-600 line-through")}>
                          {p}
                        </span>
                      ))}
                    </p>
                  </div>
                  {c.cityId === d.activeCityId ? (
                    <span className="rounded border border-cyan-500/40 px-2 py-1 text-[10px] font-bold tracking-wider text-cyan-300">ACTIVE</span>
                  ) : (
                    <button
                      disabled={busy}
                      onClick={async () => {
                        setCityId(c.cityId);
                        await patch({ activeCityId: c.cityId }, `Active city set to ${c.name}.`);
                      }}
                      className="rounded border border-[#1c2942] px-2.5 py-1 text-[10px] text-slate-300 hover:bg-white/5 disabled:opacity-50"
                    >
                      Set active
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
              Traffic and transit have no legitimate free real-time provider, so they display{" "}
              <span className="text-slate-300">Data Unavailable</span> everywhere — they are never estimated.
            </p>
          </Panel>

          {/* Data sources */}
          <Panel title="Data sources" right={<span className="text-[10px] text-slate-500">real feed health — no fabricated status</span>}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-[11px]">
                <thead>
                  <tr className="text-[9px] uppercase tracking-wider text-slate-500">
                    <th className="pb-2 pr-3">Feed</th>
                    <th className="pb-2 pr-3">Status</th>
                    <th className="pb-2 pr-3">Last run</th>
                    <th className="pb-2 pr-3">Duration</th>
                    <th className="pb-2">Note / error</th>
                  </tr>
                </thead>
                <tbody>
                  {d.providers.map((p) => (
                    <tr key={p.feedId} className="border-t border-[#141d31]">
                      <td className="py-2 pr-3 font-mono text-slate-200">{p.feedId}</td>
                      <td className={cn("py-2 pr-3 font-bold tracking-wider", FEED_CLS[p.status] ?? "text-slate-400")}>{p.status}</td>
                      <td className="py-2 pr-3 text-slate-400">{p.lastRunAt ? timeAgo(p.lastRunAt) : "never"}</td>
                      <td className="py-2 pr-3 text-slate-500">{p.durationMs !== null ? `${p.durationMs} ms` : "—"}</td>
                      <td className="py-2 text-slate-500">{p.lastError ? <span className="text-rose-300">{p.lastError.slice(0, 90)}</span> : p.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {/* AI */}
            <Panel title="AI">
              <dl className="flex flex-col gap-1.5 text-[11px]">
                {[
                  ["Provider", d.ai.provider],
                  ["SDK", d.ai.sdk],
                  ["Model", d.ai.model],
                  ["Note", d.ai.note],
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <dt className="w-20 shrink-0 text-slate-500">{k}</dt>
                    <dd className="min-w-0 break-words text-slate-300">{v}</dd>
                  </div>
                ))}
              </dl>
            </Panel>

            {/* Hindsight */}
            <Panel title="Hindsight memory">
              <div className="mb-2 flex items-center gap-2">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${d.hindsight.available ? "text-emerald-300" : "text-amber-300"}`}>
                  {d.hindsight.available ? "🟢 CONNECTED" : "🟡 UNAVAILABLE — HONEST DEGRADED MODE"}
                </span>
                {d.hindsight.version && <span className="text-[10px] text-slate-500">v{d.hindsight.version}</span>}
              </div>
              <dl className="flex flex-col gap-1.5 text-[11px]">
                {[
                  ["Server", d.hindsight.baseUrl],
                  ["Bank", d.hindsight.bankId],
                  ["Detail", d.hindsight.detail ?? "—"],
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <dt className="w-20 shrink-0 text-slate-500">{k}</dt>
                    <dd className="min-w-0 break-words text-slate-300">{v}</dd>
                  </div>
                ))}
              </dl>
            </Panel>

            {/* Privacy */}
            <Panel title="Privacy">
              <div className="flex flex-col gap-3">
                <label className="flex items-center justify-between gap-3 text-[11px] text-slate-300">
                  <span>
                    Store conversation history
                    <span className="block text-[10px] text-slate-500">Conversations persist in the app database — separate from city memory.</span>
                  </span>
                  <Switch
                    checked={d.privacy.conversationHistoryEnabled}
                    disabled={busy}
                    onCheckedChange={(v) => patch({ prefs: { conversationHistoryEnabled: v } }, v ? "Conversation history on." : "Conversation history off.")}
                    aria-label="Toggle conversation history"
                  />
                </label>
                <label className="flex items-center justify-between gap-3 text-[11px] text-slate-300">
                  <span>
                    Allow Hindsight retention
                    <span className="block text-[10px] text-slate-500">Distilled city experience (never raw chat) is retained to long-term memory.</span>
                  </span>
                  <Switch
                    checked={d.privacy.memoryRetentionEnabled}
                    disabled={busy}
                    onCheckedChange={(v) => patch({ prefs: { memoryRetentionEnabled: v } }, v ? "Memory retention on." : "Memory retention paused.")}
                    aria-label="Toggle memory retention"
                  />
                </label>
                <div className="mt-1 flex items-center justify-between gap-3 rounded border border-rose-500/30 bg-rose-500/5 px-3 py-2">
                  <div className="text-[11px]">
                    <p className="font-semibold text-rose-200">Delete all conversations</p>
                    <p className="text-[10px] text-rose-300/70">{d.privacy.conversationsStored} stored · city memory is not affected</p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button className="flex items-center gap-1.5 rounded border border-rose-500/40 px-2.5 py-1.5 text-[10px] font-semibold text-rose-300 hover:bg-rose-500/10" aria-label="Delete all conversations">
                        <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="border-[#1c2942] bg-[#0a101c] text-slate-200">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete all conversations for this city?</AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-400">
                          {d.privacy.conversationsStored} conversations will be removed from the app database. Hindsight
                          city memory is intentionally not touched by this action.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="border-[#1c2942] bg-transparent text-slate-300 hover:bg-white/5">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-rose-600 text-white hover:bg-rose-500"
                          onClick={async () => {
                            await api.deleteAllConversations(cityId).catch(() => undefined);
                            setNote("All conversations deleted.");
                            settings.refresh();
                          }}
                        >
                          Delete all
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </Panel>

            {/* Notifications */}
            <Panel title="Notifications">
              <label className="flex items-center justify-between gap-3 text-[11px] text-slate-300">
                <span>
                  Browser alerts for significant events
                  <span className="block text-[10px] text-slate-500">Fires a browser notification when MODERATE+ events arrive via the realtime stream.</span>
                </span>
                <Switch
                  defaultChecked={alertsEnabled}
                  onCheckedChange={async (v) => {
                    if (v) {
                      try {
                        if ("Notification" in window && Notification.permission !== "granted") await Notification.requestPermission();
                      } catch {
                        /* best effort */
                      }
                      localStorage.setItem("lc-browser-alerts", "1");
                    } else {
                      localStorage.removeItem("lc-browser-alerts");
                    }
                    setNote(v ? "Browser alerts enabled." : "Browser alerts disabled.");
                  }}
                  aria-label="Toggle browser alerts"
                />
              </label>
            </Panel>
          </div>
        </>
      ) : null}
    </div>
  );
}

// StatusPill re-export guard (kept for visual consistency if needed later)
export { StatusPill };
