"use client";

// LIVING CITY — single visible route. The sandbox exposes only "/", so the seven
// modular pages (Dashboard · Copilot · Memories · Live City · Live Events ·
// Analytics · Settings) switch inside this route. The persistent AppShell lives
// in src/app/layout.tsx; every page consumes the same underlying real-time
// city intelligence data layer.

import { useAppStore, type PageId } from "@/lib/store";
import { DashboardPage } from "@/components/pages/DashboardPage";
import { CopilotPage } from "@/components/pages/CopilotPage";
import { MemoriesPage } from "@/components/pages/MemoriesPage";
import { LiveCityPage } from "@/components/pages/LiveCityPage";
import { LiveEventsPage } from "@/components/pages/LiveEventsPage";
import { AnalyticsPage } from "@/components/pages/AnalyticsPage";
import { SettingsPage } from "@/components/pages/SettingsPage";

const PAGES: Record<PageId, React.ComponentType> = {
  dashboard: DashboardPage,
  copilot: CopilotPage,
  memories: MemoriesPage,
  "live-city": LiveCityPage,
  "live-events": LiveEventsPage,
  analytics: AnalyticsPage,
  settings: SettingsPage,
};

export default function Page() {
  const page = useAppStore((s) => s.page);
  const Active = PAGES[page] ?? DashboardPage;
  return <Active />;
}
