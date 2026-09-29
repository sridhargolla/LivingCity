// LIVING CITY — Copilot → Hindsight retain (PHASE 6 memory commands).
// "Remember this" stores a DISTILLED experience — never the raw conversation.

import { db } from "@/lib/db";
import { HindsightMemoryService } from "@/server/hindsight/HindsightMemoryService";
import { bankIdForCity, getCityConfig } from "@/server/cities";
import { sanitizeUntrusted } from "@/server/llm/reasoning";

/**
 * Retain an operator-requested experience from a conversation.
 * The text is sanitized, prefixed with provenance, and tagged so it can never be
 * mistaken for sensor data. Returns success boolean (honest — no fake success).
 */
export async function retainExperienceFromCopilot(opts: {
  cityId: string;
  conversationId: string;
  text: string;
}): Promise<boolean> {
  const city = getCityConfig(opts.cityId);
  const clean = sanitizeUntrusted(opts.text.replace(/^\s*remember(\s+this)?[:,]?\s*/i, "")).slice(0, 1200);
  if (clean.length < 8) return false;

  const fact = `Operator instruction (via Ask-the-City, ${new Date().toISOString().slice(0, 16)} UTC, ${city.name}): ${clean}`;

  const res = await HindsightMemoryService.retain_event_experience({
    eventId: "copilot",
    fact,
    context: `Living City operator-requested memory — ${city.name}`,
    occurredAt: new Date(),
    tags: ["copilot", "operator-requested", `city:${city.cityId}`],
    metadata: {
      cityId: city.cityId,
      conversationId: opts.conversationId,
      origin: "OPERATOR_REQUESTED",
    },
    bankId: bankIdForCity(opts.cityId),
  });
  return res.success;
}
