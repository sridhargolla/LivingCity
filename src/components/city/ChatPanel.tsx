"use client";

// LIVING CITY — "Ask the City" copilot panel (PHASES 5-7, 16).
// Persistent conversations · evidence-first answers · structured map/source/memory
// actions · voice input/output · live/simulated provenance in every answer.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  type ChatAction,
  type ChatAssistantMessage,
  type ConversationSummary,
  type EvidenceObject,
} from "@/lib/city-api";
import { ORIGIN_META, timeAgo } from "@/lib/city-format";
import { useVoiceInput, useSpeechOutput } from "@/hooks/useVoice";

export interface ChatPanelHandle {
  refreshConversations: () => void;
}

interface ChatPanelProps {
  cityId: string;
  cityName: string;
  selectedEventId: string | null;
  onAction: (action: ChatAction) => void;
  onMessagesChanged?: () => void;
}

interface UiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  intent?: string | null;
  actions?: ChatAction[];
  evidence?: EvidenceObject[];
  eventRefs?: string[];
  transferred?: { cityName: string; text: string } | null;
  degraded?: boolean;
  createdAt: string;
  pending?: boolean;
}

export function ChatPanel({ cityId, cityName, selectedEventId, onAction, onMessagesChanged }: ChatPanelProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const voice = useVoiceInput({ onFinalTranscript: (t) => setInput((prev) => (prev ? `${prev} ${t}` : t)) });
  const tts = useSpeechOutput();

  const loadConversations = useCallback(async () => {
    try {
      const r = await api.conversations({ cityId, q: search || undefined });
      setConversations(r.conversations);
    } catch {
      /* keep old list */
    }
  }, [cityId, search]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const openConversation = useCallback(async (id: string) => {
    setActiveId(id);
    setListOpen(false);
    try {
      const r = await api.conversation(id);
      setMessages(
        r.conversation.messages.map((m) => ({
          id: m.id,
          role: m.role === "user" ? "user" : "assistant",
          content: m.content,
          intent: m.intent,
          actions: (m.actions ?? []) as ChatAction[],
          evidence: (m.evidenceRefs ?? []) as EvidenceObject[],
          eventRefs: m.eventRefs,
          degraded: m.degraded,
          createdAt: m.createdAt,
        }))
      );
    } catch {
      setError("Could not load that conversation.");
    }
  }, []);

  const newConversation = useCallback(async () => {
    try {
      const r = await api.createConversation(cityId);
      setActiveId(r.conversation.id);
      setMessages([]);
      setListOpen(false);
      loadConversations();
    } catch {
      setError("Could not create a new discussion.");
    }
  }, [cityId, loadConversations]);

  // auto-create the first conversation on mount
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api.conversations({ cityId });
        if (!alive) return;
        if (r.conversations.length === 0) {
          const created = await api.createConversation(cityId);
          if (!alive) return;
          setActiveId(created.conversation.id);
          loadConversations();
        } else {
          setActiveId((cur) => cur ?? r.conversations[0].id);
          openConversation(r.conversations[0].id);
        }
      } catch {
        /* offline — text input still works when backend returns */
      }
    })();
    return () => {
      alive = false;
    };
  }, [cityId]);

  const send = useCallback(
    async (text: string) => {
      const msg = text.trim();
      if (!msg || sending) return;
      let convId = activeId;
      if (!convId) {
        try {
          const created = await api.createConversation(cityId);
          convId = created.conversation.id;
          setActiveId(convId);
          loadConversations();
        } catch {
          setError("Could not start a discussion.");
          return;
        }
      }
      setSending(true);
      setError(null);
      const now = new Date().toISOString();
      setMessages((m) => [...m, { id: `u-${Date.now()}`, role: "user", content: msg, createdAt: now }]);
      setMessages((m) => [...m, { id: `pending-${Date.now()}`, role: "assistant", content: "…", createdAt: now, pending: true }]);
      setInput("");
      try {
        const r = await api.askCity(convId, msg, selectedEventId);
        setMessages((m) => {
          const withoutPending = m.filter((x) => !x.pending);
          return [
            ...withoutPending,
            {
              id: r.assistantMessage.id,
              role: "assistant",
              content: r.assistantMessage.content,
              intent: r.assistantMessage.intent,
              actions: r.assistantMessage.actions ?? [],
              evidence: r.assistantMessage.evidence ?? [],
              eventRefs: r.assistantMessage.eventRefs,
              transferred: r.assistantMessage.transferred,
              degraded: r.assistantMessage.degraded,
              createdAt: r.assistantMessage.createdAt,
            },
          ];
        });
        tts.speak(r.assistantMessage.content);
        onMessagesChanged?.();
        loadConversations();
      } catch (e) {
        setMessages((m) => {
          const withoutPending = m.filter((x) => !x.pending);
          return [...withoutPending, { id: `err-${Date.now()}`, role: "assistant", content: e instanceof Error ? e.message : "The copilot is temporarily unavailable.", degraded: true, createdAt: now }];
        });
      } finally {
        setSending(false);
      }
    },
    [activeId, cityId, selectedEventId, sending, loadConversations, tts, onMessagesChanged]
  );

  // autoscroll
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const deleteConv = useCallback(
    async (id: string) => {
      await api.deleteConversation(id).catch(() => undefined);
      if (id === activeId) {
        setActiveId(null);
        setMessages([]);
      }
      loadConversations();
    },
    [activeId, loadConversations]
  );

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-lg border border-[#1c2942] bg-[#0a101c]">
      {/* header */}
      <div className="flex items-center justify-between gap-2 border-b border-[#1c2942] px-4 py-2.5">
        <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-slate-200">
          <span aria-hidden>💬</span> Ask the City
          <span className="hidden rounded bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-cyan-300 md:inline">
            {cityName} copilot
          </span>
        </h2>
        <div className="flex items-center gap-1.5">
          {tts.supported && (
            <button
              onClick={() => tts.setEnabled(!tts.enabled)}
              title={tts.enabled ? "Voice output on — click to mute" : "Muted — click to hear answers"}
              aria-label="Toggle voice output"
              className={`rounded border px-2 py-1 text-[10px] font-semibold tracking-wider transition-colors ${
                tts.enabled
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-[#1c2942] text-slate-500 hover:text-slate-300"
              }`}
            >
              {tts.enabled ? "🔊 ON" : "🔇 OFF"}
            </button>
          )}
          <button
            onClick={() => setListOpen((v) => !v)}
            className="rounded border border-[#1c2942] px-2 py-1 text-[10px] font-semibold tracking-wider text-slate-400 hover:text-slate-200"
            aria-expanded={listOpen}
          >
            ☰ {conversations.length}
          </button>
          <button
            onClick={newConversation}
            className="rounded border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 text-[10px] font-semibold tracking-wider text-cyan-300 hover:bg-cyan-500/20"
          >
            + NEW
          </button>
        </div>
      </div>

      {/* conversation list */}
      {listOpen && (
        <div className="border-b border-[#1c2942] bg-[#080d18] px-3 py-2.5">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations…"
            className="mb-2 w-full rounded border border-[#1c2942] bg-[#0d1526] px-2.5 py-1.5 text-[11px] text-slate-200 placeholder:text-slate-600 focus:border-cyan-500/40 focus:outline-none"
            aria-label="Search conversations"
          />
          <div className="lc-scroll max-h-48 space-y-1 overflow-y-auto">
            {conversations.length === 0 && <p className="px-1 py-2 text-[11px] text-slate-600">No conversations yet.</p>}
            {conversations.map((c) => (
              <div
                key={c.id}
                className={`group flex items-center gap-2 rounded border px-2 py-1.5 ${
                  c.id === activeId ? "border-cyan-500/40 bg-cyan-500/5" : "border-transparent hover:border-[#1c2942] hover:bg-[#0d1526]"
                }`}
              >
                <button onClick={() => openConversation(c.id)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-[11px] font-medium text-slate-200">{c.title}</p>
                  <p className="truncate text-[10px] text-slate-600">
                    {timeAgo(c.updatedAt)} · {c.lastMessagePreview || "empty"}
                  </p>
                </button>
                <button
                  onClick={() => deleteConv(c.id)}
                  className="shrink-0 rounded px-1 text-[10px] text-slate-700 opacity-0 transition-opacity hover:text-rose-400 group-hover:opacity-100"
                  aria-label={`Delete conversation ${c.title}`}
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* messages */}
      <div ref={scrollRef} className="lc-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3" style={{ minHeight: 260 }}>
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <span className="text-2xl opacity-40">💬</span>
            <p className="text-xs text-slate-400">Ask about current conditions, past incidents, evidence, or city memory.</p>
            <div className="mt-1 flex flex-wrap justify-center gap-1.5">
              {["What is happening right now?", "Is it raining?", "Have we seen this before?", "Prove it."].map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="rounded-full border border-[#1c2942] bg-[#0d1526] px-2.5 py-1 text-[10px] text-slate-400 hover:border-cyan-500/40 hover:text-cyan-300"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[92%] rounded-lg border px-3 py-2 ${m.role === "user" ? "border-cyan-500/30 bg-cyan-500/10" : "border-[#141d31] bg-[#0d1526]"} ${m.pending ? "animate-pulse opacity-60" : ""}`}>
              <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-slate-100">{m.content}</p>
              {m.transferred && (
                <div className="mt-1.5 rounded border border-sky-500/30 bg-sky-500/5 px-2 py-1">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-sky-300">⟶ Transferred experience · {m.transferred.cityName}</p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-sky-100/70">{m.transferred.text}</p>
                </div>
              )}
              {m.degraded && (
                <span className="mt-1 inline-block rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-amber-300">
                  DETERMINISTIC FALLBACK
                </span>
              )}
              {m.evidence && m.evidence.length > 0 && (
                <div className="mt-2 space-y-1">
                  {m.evidence.slice(0, 3).map((ev) => (
                    <div key={`${ev.event_id}-${ev.claim.slice(0, 12)}`} className="rounded border border-[#1c2942] bg-[#080d18] px-2 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`rounded border px-1 py-0.5 text-[8px] font-bold tracking-wider ${ORIGIN_META[ev.data_origin]?.badge ?? ""}`}>
                          {ORIGIN_META[ev.data_origin]?.label ?? ev.data_origin}
                        </span>
                        <span className="truncate text-[9px] text-slate-500">{ev.sourceName} · {timeAgo(ev.observed_at)}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-slate-400">{ev.claim}</p>
                      <div className="mt-1 flex gap-1.5">
                        <button onClick={() => onAction({ type: "show_evidence", eventId: ev.event_id })} className="rounded border border-cyan-500/30 px-1.5 py-0.5 text-[9px] font-semibold text-cyan-300 hover:bg-cyan-500/10">
                          Evidence
                        </button>
                        <button onClick={() => onAction({ type: "open_event", eventId: ev.event_id })} className="rounded border border-[#1c2942] px-1.5 py-0.5 text-[9px] text-slate-400 hover:text-slate-200">
                          View event
                        </button>
                        {ev.source_url && (
                          <button onClick={() => onAction({ type: "open_source", eventId: ev.event_id, url: ev.source_url ?? undefined })} className="rounded border border-[#1c2942] px-1.5 py-0.5 text-[9px] text-slate-400 hover:text-slate-200">
                            Open source ↗
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {m.role === "assistant" && m.actions && m.actions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.actions.slice(0, 3).map((a, i) => (
                    <button
                      key={`${a.type}-${i}`}
                      onClick={() => onAction(a)}
                      className="rounded border border-[#1c2942] bg-[#080d18] px-2 py-1 text-[10px] font-semibold text-slate-300 transition-colors hover:border-cyan-500/40 hover:text-cyan-300"
                    >
                      {ACTION_LABELS[a.type] ?? a.type}
                    </button>
                  ))}
                </div>
              )}
              {m.intent && m.role === "assistant" && !m.pending && (
                <p className="mt-1 text-[9px] uppercase tracking-wider text-slate-700">
                  {m.intent.replaceAll("_", " ").toLowerCase()}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* input */}
      <div className="border-t border-[#1c2942] px-3 py-2.5">
        {error && (
          <p className="mb-1.5 rounded border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[10px] text-rose-300">{error}</p>
        )}
        {voice.state === "listening" && (
          <p className="mb-1.5 flex items-center gap-1.5 text-[10px] text-cyan-300">
            <span className="lc-live-dot" aria-hidden /> Listening… <span className="text-slate-500">{voice.interim.slice(0, 60)}</span>
          </p>
        )}
        {voice.error && (
          <p className="mb-1.5 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-300">
            {voice.error}{" "}
            <button onClick={voice.dismissError} className="underline hover:text-amber-200">dismiss</button>
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={2}
            placeholder={`Ask about ${cityName}…  (e.g. "what happened last time?")`}
            className="lc-scroll max-h-24 min-h-[44px] flex-1 resize-none rounded-md border border-[#1c2942] bg-[#0d1526] px-3 py-2 text-[12px] text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/40 focus:outline-none"
            aria-label="Ask the City"
          />
          {voice.supported && (
            <button
              onClick={() => (voice.state === "listening" ? voice.stop() : voice.start())}
              title={voice.state === "listening" ? "Stop recording" : "Ask by voice"}
              aria-label="Toggle voice input"
              className={`flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-md border text-base transition-colors ${
                voice.state === "listening"
                  ? "border-rose-500/50 bg-rose-500/15 text-rose-300"
                  : "border-[#1c2942] bg-[#0d1526] text-slate-400 hover:border-cyan-500/40 hover:text-cyan-300"
              }`}
            >
              {voice.state === "listening" ? "⏹" : "🎙"}
            </button>
          )}
          <button
            onClick={() => send(input)}
            disabled={sending || !input.trim()}
            className="h-[44px] shrink-0 rounded-md border border-cyan-500/40 bg-cyan-500/15 px-4 text-xs font-bold tracking-wider text-cyan-200 transition-colors hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {sending ? "…" : "ASK"}
          </button>
        </div>
      </div>
    </section>
  );
}

const ACTION_LABELS: Record<string, string> = {
  open_event: "📍 View event",
  focus_map: "🗺 Focus map",
  show_evidence: "🧾 Show evidence",
  open_source: "🔗 Open source",
  open_memory: "🧠 View memory",
  open_historical_event: "📜 Historical event",
  show_related_events: "🕸 Related events",
  show_memory_graph: "🧠 Memory graph",
  show_conversation: "💬 Open discussion",
  retain_memory: "🧠 Remember",
  run_scenario: "⚡ What-if",
};
