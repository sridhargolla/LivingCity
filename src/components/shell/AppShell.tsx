// LIVING CITY — application shell: persistent navigation, city selector,
// realtime status, sticky footer. Seven modular pages render inside this shell.

"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  LayoutDashboard, Brain, Map as MapIcon, Siren, BarChart3, Settings as SettingsIcon,
  MessageSquareText, Menu, X, Globe2, type LucideIcon,
} from "lucide-react";
import { api, type CityConfigPublic } from "@/lib/city-api";
import { useAppStore, type PageId } from "@/lib/store";
import { useRealtime, type RealtimePayload } from "@/hooks/useRealtime";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const NAV: Array<{ id: PageId; label: string; icon: LucideIcon; hint: string }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, hint: "Real-time city overview" },
  { id: "copilot", label: "AI City Copilot", icon: MessageSquareText, hint: "Ask the city anything" },
  { id: "memories", label: "Memories", icon: Brain, hint: "Hindsight city memory" },
  { id: "live-city", label: "Live City", icon: MapIcon, hint: "Real-time map" },
  { id: "live-events", label: "Live Events", icon: Siren, hint: "Incoming real events" },
  { id: "analytics", label: "Analytics", icon: BarChart3, hint: "Trends & patterns" },
  { id: "settings", label: "Settings", icon: SettingsIcon, hint: "Sources, AI, privacy" },
];

function StatusDot({ ok, label, title }: { ok: boolean | null; label: string; title: string }) {
  return (
    <span
      title={title}
      className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400"
    >
      <span
        aria-hidden
        className={cn(
          "inline-block h-2 w-2 rounded-full",
          ok === null ? "bg-slate-600" : ok ? "bg-emerald-400 shadow-[0_0_6px_#34d399]" : "bg-amber-400 shadow-[0_0_6px_#fbbf24]"
        )}
      />
      {label}
    </span>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const page = useAppStore((s) => s.page);
  const setPage = useAppStore((s) => s.setPage);
  const [hindsightOk, setHindsightOk] = useState<boolean | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const { cityId, setCityId, cities, setCities } = useAppStore();

  // Hydration-safe "mounted" flag without setState-in-effect.
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  );

  // Deep-link via hash (#/copilot) and browser back/forward — single-route sandbox.
  useEffect(() => {
    const apply = () => {
      const h = window.location.hash.replace(/^#\/?/, "");
      if (NAV.some((n) => n.id === h)) setPage(h as PageId);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, [setPage]);

  useEffect(() => {
    api
      .cities()
      .then((r) => setCities(r.cities as CityConfigPublic[]))
      .catch(() => undefined);
  }, [setCities]);

  useEffect(() => {
    const load = () =>
      api
        .health()
        .then((h) => setHindsightOk(Boolean(h.hindsight?.available)))
        .catch(() => setHindsightOk(false));
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  }, []);

  const onRealtime = useCallback(
    (p: RealtimePayload) => {
      if (p.event === "event.created") {
        const ev = p.data.event as { id?: string; title?: string; cityId?: string; severity?: string } | undefined;
        if (ev && (ev.cityId ?? "hyderabad") === cityId) {
          showToast(`New event: ${ev.title ?? "Unnamed"}`);
          if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
            const alertsOn = localStorage.getItem("lc-browser-alerts") === "1";
            if (alertsOn && ["MODERATE", "MAJOR", "CRITICAL"].includes(ev.severity ?? "")) {
              try {
                new Notification("Living City — new event", { body: ev.title ?? "", tag: ev.id });
              } catch {
                /* notification is best-effort */
              }
            }
          }
        }
      }
      if (p.event === "anomaly.detected") {
        showToast(`Anomaly detected: ${String(p.data.metric ?? "metric")} deviates from baseline`);
      }
    },
    [cityId, showToast]
  );
  const { connected } = useRealtime(onRealtime);

  const navigate = useCallback(
    (p: PageId) => {
      setPage(p);
      if (typeof window !== "undefined") window.history.replaceState(null, "", `#/${p}`);
      setMobileOpen(false);
    },
    [setPage]
  );

  const navList = () => (
    <nav aria-label="Main navigation" className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = page === item.id;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            onClick={() => navigate(item.id)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors",
              active
                ? "bg-cyan-500/10 text-cyan-300 ring-1 ring-inset ring-cyan-500/30"
                : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
            )}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span className="flex flex-col">
              <span className="text-sm font-medium leading-tight">{item.label}</span>
              <span className="text-[10px] text-slate-500 group-hover:text-slate-400">{item.hint}</span>
            </span>
          </button>
        );
      })}
    </nav>
  );

  const citySelect = (
    <Select value={mounted ? cityId : undefined} onValueChange={setCityId}>
      <SelectTrigger
        aria-label="Select city"
        className="h-9 w-[150px] border-[#1c2942] bg-[#0a101c] text-xs text-slate-200"
      >
        <Globe2 className="mr-1 h-3.5 w-3.5 text-cyan-400" aria-hidden />
        <SelectValue placeholder="City" />
      </SelectTrigger>
      <SelectContent className="border-[#1c2942] bg-[#0a101c] text-slate-200">
        {(cities.length > 0 ? cities : [{ cityId: "hyderabad", name: "Hyderabad" } as CityConfigPublic]).map((c) => (
          <SelectItem key={c.cityId} value={c.cityId} className="text-xs">
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="lc-root flex min-h-screen flex-col">
      <div className="lc-scanline flex min-h-screen flex-col">
        <header className="sticky top-0 z-50 border-b border-[#1c2942] bg-[#05080f]/95 backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center gap-3 px-4">
            <button onClick={() => navigate("dashboard")} className="flex items-center gap-2" aria-label="Living City home">
              <span aria-hidden className="text-lg">🌍</span>
              <span className="text-sm font-bold tracking-[0.18em] text-cyan-300">LIVING CITY</span>
            </button>

            <div className="mx-2 hidden items-center gap-4 md:flex">
              <StatusDot ok={connected} label="Realtime" title={connected ? "SSE realtime stream connected" : "Realtime stream reconnecting…"} />
              <StatusDot
                ok={hindsightOk}
                label="Memory"
                title={hindsightOk ? "Hindsight memory system reachable" : "Hindsight unreachable — running in honest degraded mode"}
              />
            </div>

            <div className="ml-auto flex items-center gap-2">
              {/* render city selector only after mount (persisted store) */}
              {mounted ? (
                citySelect
              ) : (
                <div aria-hidden className="h-9 w-[150px] rounded border border-[#1c2942] bg-[#0a101c]" />
              )}
              {/* mobile nav */}
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <button
                    aria-label="Open navigation menu"
                    className="rounded-md border border-[#1c2942] p-2 text-slate-300 hover:bg-white/5 lg:hidden"
                  >
                    {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                  </button>
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="w-72 border-[#1c2942] bg-[#070d18] p-4 text-slate-200 [&>button]:text-slate-400"
                >
                  <SheetHeader className="p-0 pb-3">
                    <SheetTitle className="text-left text-xs font-bold tracking-[0.2em] text-cyan-300">
                      LIVING CITY
                    </SheetTitle>
                  </SheetHeader>
                  {navList()}
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-[1600px] flex-1">
          <aside className="hidden w-60 shrink-0 border-r border-[#1c2942] py-4 pl-3 pr-2 lg:block">
            {navList()}
            <div className="mt-6 rounded-md border border-[#1c2942] bg-[#0a101c] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Data policy</p>
              <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                Only verified live data is displayed. Missing sources show{" "}
                <span className="text-slate-300">Data Unavailable</span> — never estimates.
              </p>
            </div>
          </aside>

          <main className="min-w-0 flex-1 px-4 py-4">{children}</main>
        </div>

        <footer className="mt-auto border-t border-[#1c2942] bg-[#05080f]">
          <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center justify-between gap-2 px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
            <p className="text-[10px] uppercase tracking-[0.24em] text-slate-600">
              Living City · city memory by Hindsight
            </p>
            <p className="text-[10px] text-slate-600">
              Verified live data only · missing data shown honestly · evidence for every claim
            </p>
          </div>
        </footer>
      </div>

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-[2100] max-w-md -translate-x-1/2 rounded border border-cyan-500/40 bg-[#0d1526] px-4 py-2.5 text-[12px] text-cyan-200 shadow-lg shadow-cyan-500/10"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
