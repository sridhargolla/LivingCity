// LIVING CITY — Voice interaction hook (PHASE 16).
// Speech recognition (browser Web Speech API) + speech synthesis.
// Same chat pipeline as text — voice is an INPUT/OUTPUT layer only.
// If unavailable, text chat remains fully functional (graceful degradation).

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>>; resultIndex: number }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type RecognitionCtor = new () => SpeechRecognitionLike;

export type VoiceState = "idle" | "requesting" | "listening" | "transcribing" | "error" | "unsupported";

export function useVoiceInput(opts: { onFinalTranscript: (text: string) => void }) {
  const [state, setState] = useState<VoiceState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [interim, setInterim] = useState("");
  const [supported, setSupported] = useState(false); // set in effect — avoids SSR hydration mismatch
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef("");
  const cbRef = useRef(opts.onFinalTranscript);
  useEffect(() => {
    cbRef.current = opts.onFinalTranscript;
  }, [opts.onFinalTranscript]);

  useEffect(() => {
    const t = setTimeout(() => {
      const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
      setSupported(Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition));
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* ignore */
    }
    recognitionRef.current = null;
    setInterim("");
    setState("idle");
  }, []);

  const start = useCallback(() => {
    if (!supported) {
      setState("unsupported");
      setError("Voice input is not supported in this browser — text chat remains fully available.");
      return;
    }
    if (recognitionRef.current) return;
    setState("requesting");
    setError(null);
    finalRef.current = "";

    try {
      const Ctor: RecognitionCtor | undefined =
        (window as unknown as { SpeechRecognition?: RecognitionCtor }).SpeechRecognition ??
        (window as unknown as { webkitSpeechRecognition?: RecognitionCtor }).webkitSpeechRecognition;
      if (!Ctor) throw new Error("unavailable");
      const rec = new Ctor();
      rec.lang = "en-IN";
      rec.continuous = false;
      rec.interimResults = true;

      rec.onresult = (e) => {
        let final = "";
        let interimText = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          const t = r[0]?.transcript ?? "";
          if (i < e.results.length && r) {
            // last result is final when isFinal — approximate via index >= resultIndex
          }
          interimText += t;
          final = t; // keep the latest transcript chunk
        }
        finalRef.current = finalRef.current || final;
        setInterim(interimText);
      };

      rec.onerror = (e) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          setError("Microphone permission denied. You can enable it in browser settings — text chat remains available.");
        } else if (e.error === "no-speech") {
          setError("No speech detected — try again.");
        } else {
          setError(`Voice input error: ${e.error}. Text chat remains available.`);
        }
        setState("error");
        recognitionRef.current = null;
      };

      rec.onend = () => {
        const text = finalRef.current.trim();
        recognitionRef.current = null;
        setInterim("");
        if (text) {
          setState("transcribing");
          cbRef.current(text);
          // brief transcribing state then idle (the chat sends the message)
          setTimeout(() => setState("idle"), 350);
        } else {
          setState("idle");
        }
      };

      recognitionRef.current = rec;
      setState("listening");
      rec.start();
    } catch {
      setError("Could not start voice input. Text chat remains available.");
      setState("error");
      recognitionRef.current = null;
    }
  }, [supported]);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return { state, interim, error, supported, start, stop, dismissError: () => setError(null) };
}

/** Text → speech. Returns whether synthesis is available + speak/stop controls. */
export function useSpeechOutput() {
  const [enabled, setEnabled] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(false); // set in effect — avoids SSR hydration mismatch

  useEffect(() => {
    const t = setTimeout(() => {
      setSupported(typeof window !== "undefined" && Boolean(window.speechSynthesis));
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (!enabled || typeof window === "undefined" || !window.speechSynthesis) return;
      try {
        window.speechSynthesis.cancel();
        // strip emoji + markdown-ish symbols for cleaner speech
        const clean = text
          .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
          .replace(/[*_#`]/g, "")
          .slice(0, 600);
        const u = new SpeechSynthesisUtterance(clean);
        u.rate = 1.04;
        u.pitch = 1;
        u.onend = () => setSpeaking(false);
        u.onerror = () => setSpeaking(false);
        setSpeaking(true);
        window.speechSynthesis.speak(u);
      } catch {
        setSpeaking(false);
      }
    },
    [enabled]
  );

  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  return { enabled, setEnabled, speaking, speak, stopSpeaking, supported };
}
