"use client";

// LIVING CITY — AI City Copilot: full-page "Ask the City" experience.
// Persistent conversations · evidence cards · cross-page structured actions
// (map focus, event details, memory graph) · voice input/output.

import { useCallback, useState } from "react";
import { api, type ChatAction } from "@/lib/city-api";
import { isSafeExternalUrlClient } from "@/lib/city-format";
import { useAppStore } from "@/lib/store";
import { ChatPanel } from "@/components/city/ChatPanel";
import { EvidenceDialog } from "@/components/city/EvidenceDialog";

export function CopilotPage() {
  const cityId = useAppStore((s) => s.cityId);
  const cityName = useAppStore((s) => s.cityName);
  const setPage = useAppStore((s) => s.setPage);
  const selectEvent = useAppStore((s) => s.selectEvent);
  const focusEvent = useAppStore((s) => s.focusEvent);
  const selectedEventId = useAppStore((s) => s.selectedEventId);

  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceEventId, setEvidenceEventId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 4200);
  }, []);

  // Chat → app actions. Only validated structured actions reach here.
  const handleAction = useCallback(
    (a: ChatAction) => {
      switch (a.type) {
        case "open_event":
        case "open_historical_event":
        case "show_related_events":
          if (a.eventId) {
            selectEvent(a.eventId);
            setPage("live-events");
            showToast("Opened the event in Live Events.");
          }
          break;
        case "focus_map":
          if (a.eventId) {
            focusEvent(a.eventId);
            selectEvent(a.eventId);
            setPage("live-city");
            showToast("Focused the map on the event.");
          }
          break;
        case "show_evidence":
          if (a.eventId) {
            setEvidenceEventId(a.eventId);
            setEvidenceOpen(true);
          }
          break;
        case "open_source":
          if (a.url && isSafeExternalUrlClient(a.url)) {
            window.open(a.url, "_blank", "noopener,noreferrer");
          } else {
            showToast("That source URL is not on the verified allowlist — refusing to open it.");
          }
          break;
        case "open_memory":
        case "show_memory_graph":
          setPage("memories");
          showToast("Opened the city Memories page.");
          break;
        case "show_conversation":
          showToast("Use ☰ in the chat header to browse, search and continue conversations.");
          break;
        case "retain_memory":
          showToast('Type "Remember this: …" in the chat to store an operator-requested experience.');
          break;
        case "run_scenario":
          showToast('Ask here, e.g. "What if the rain continues for another 6 hours?"');
          break;
        default:
          break;
      }
    },
    [focusEvent, selectEvent, setPage, showToast]
  );

  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex h-[calc(100vh-9.5rem)] min-h-[540px] flex-col">
        <ChatPanel
          cityId={cityId}
          cityName={cityName}
          selectedEventId={selectedEventId}
          onAction={handleAction}
        />
      </div>

      <EvidenceDialog
        open={evidenceOpen}
        eventId={evidenceEventId}
        cityId={cityId}
        onClose={() => {
          setEvidenceOpen(false);
          setEvidenceEventId(null);
        }}
        onViewEvent={(id) => {
          setEvidenceOpen(false);
          selectEvent(id);
          setPage("live-events");
        }}
        onFocusMap={(id) => {
          setEvidenceOpen(false);
          focusEvent(id);
          selectEvent(id);
          setPage("live-city");
        }}
      />

      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 z-[2100] -translate-x-1/2 rounded border border-cyan-500/40 bg-[#0d1526] px-4 py-2.5 text-[12px] text-cyan-200 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
