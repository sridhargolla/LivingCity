"use client";

// LIVING CITY — shared page primitives. Every page renders inside AppShell with
// the same visual language: dark command-center panels, honest status labeling.

import type { ReactNode } from "react";
import type { MetricCard, MetricStatus } from "@/lib/city-api";
import { timeAgo } from "@/lib/city-format";
import { cn } from "@/lib/utils";

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-lg font-bold tracking-wide text-slate-100">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      {right ? <div className="flex shrink-0 items-center gap-2">{right}</div> : null}
    </div>
  );
}

export function Panel({
  title,
  right,
  children,
  className,
  bodyClassName,
  id,
}: {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("flex min-w-0 flex-col rounded-lg border border-[#1c2942] bg-[#0a101c]", className)}>
      {title || right ? (
        <div className="flex items-center justify-between gap-2 border-b border-[#1c2942] px-4 py-2.5">
          <h2 className="text-xs font-bold uppercase tracking-[0.22em] text-slate-300">{title}</h2>
          {right}
        </div>
      ) : null}
      <div className={cn("min-w-0 flex-1 p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

const STATUS_META: Record<MetricStatus, { label: string; dot: string; text: string }> = {
  LIVE: { label: "LIVE", dot: "bg-emerald-400 shadow-[0_0_6px_#34d399]", text: "text-emerald-300" },
  DEGRADED: { label: "DEGRADED", dot: "bg-amber-400 shadow-[0_0_6px_#fbbf24]", text: "text-amber-300" },
  UNAVAILABLE: { label: "DATA UNAVAILABLE", dot: "bg-slate-600", text: "text-slate-400" },
};

export function StatusPill({ status, small }: { status: MetricStatus; small?: boolean }) {
  const m = STATUS_META[status] ?? STATUS_META.UNAVAILABLE;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded border border-[#1c2942] bg-[#070d18] px-1.5 py-0.5",
        small ? "text-[9px]" : "text-[10px]",
        "font-bold uppercase tracking-wider",
        m.text
      )}
    >
      <span aria-hidden className={cn("inline-block h-1.5 w-1.5 rounded-full", m.dot)} />
      {m.label}
    </span>
  );
}

export function MetricTile({ m }: { m: MetricCard }) {
  const unavailable = m.status === "UNAVAILABLE";
  return (
    <div className="flex min-w-0 flex-col rounded-lg border border-[#1c2942] bg-[#0a101c] p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{m.label}</p>
        <StatusPill status={m.status} small />
      </div>
      {unavailable ? (
        <>
          <p className="mt-2 text-base font-semibold text-slate-300">Data Unavailable</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            {m.note || "No verified provider is configured for this metric. No estimate is shown."}
          </p>
        </>
      ) : (
        <>
          <p className={cn("mt-2 truncate text-2xl font-bold", m.status === "LIVE" ? "text-slate-100" : "text-amber-200")}>
            {m.value}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-slate-400">{m.detail}</p>
          <p className="mt-2 truncate text-[10px] text-slate-500">
            {m.source ? `Source: ${m.source}` : "Source: —"}
            {m.observedAt ? ` · observed ${timeAgo(m.observedAt)}` : ""}
          </p>
        </>
      )}
    </div>
  );
}

export function LoadingBlock({ label = "Loading live data…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-6 text-xs text-slate-500">
      <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-500/30 border-t-cyan-400" />
      {label}
    </div>
  );
}

export function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-300">
      Data Unavailable — {message}
    </div>
  );
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return <p className="py-4 text-[11px] leading-relaxed text-slate-500">{children}</p>;
}
