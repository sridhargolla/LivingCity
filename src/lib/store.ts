// LIVING CITY — global client state (Zustand).
// City selection is persisted; realtime focus event is session-only.

"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CityConfigPublic } from "@/lib/city-api";

export type PageId =
  | "dashboard"
  | "copilot"
  | "memories"
  | "live-city"
  | "live-events"
  | "analytics"
  | "settings";

interface AppState {
  cityId: string;
  cityName: string;
  cities: CityConfigPublic[];
  setCityId: (id: string) => void;
  setCities: (cities: CityConfigPublic[]) => void;
  /** Cross-page chat→map action: which event to focus on the Live City map. */
  focusEventId: string | null;
  focusTick: number;
  focusEvent: (id: string) => void;
  clearFocus: () => void;
  /** Active page (single-route sandbox: pages switch inside /). */
  page: PageId;
  setPage: (p: PageId) => void;
  /** Event selected in a detail panel (shared across pages). */
  selectedEventId: string | null;
  selectEvent: (id: string | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      cityId: "hyderabad",
      cityName: "Hyderabad",
      cities: [],
      setCityId: (id) =>
        set((s) => ({ cityId: id, cityName: s.cities.find((c) => c.cityId === id)?.name ?? s.cityName })),
      setCities: (cities) =>
        set((s) => ({
          cities,
          cityName: cities.find((c) => c.cityId === s.cityId)?.name ?? s.cityName,
        })),
      focusEventId: null,
      focusTick: 0,
      focusEvent: (id) => set((s) => ({ focusEventId: id, focusTick: s.focusTick + 1 })),
      clearFocus: () => set({ focusEventId: null }),
      page: "dashboard",
      setPage: (p) => set({ page: p }),
      selectedEventId: null,
      selectEvent: (id) => set({ selectedEventId: id }),
    }),
    {
      name: "living-city-app",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ cityId: s.cityId }) as unknown as AppState,
    }
  )
);
