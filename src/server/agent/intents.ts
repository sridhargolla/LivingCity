// LIVING CITY — Deterministic intent detection (PHASE 6).
// Fast paths keep most questions OFF the LLM (performance rule: not every UI
// interaction may call the LLM). Ambiguous input falls through to LLM classification.

export type Intent =
  | "CURRENT_STATUS"
  | "WEATHER"
  | "EVENT_LOOKUP"
  | "HISTORICAL_LOOKUP"
  | "MEMORY_RECALL"
  | "PATTERN_ANALYSIS"
  | "ANOMALY_ANALYSIS"
  | "EVIDENCE_REQUEST"
  | "SOURCE_REQUEST"
  | "MAP_REQUEST"
  | "SCENARIO_ANALYSIS"
  | "CITY_LEARNING"
  | "CONVERSATION_CONTINUATION"
  | "REMEMBER"
  | "FORGET"
  | "SEARCH_CONVERSATIONS"
  | "GENERAL_CITY_QUERY";

export interface IntentResult {
  intent: Intent;
  /** True when regex matching was confident enough to skip LLM classification. */
  deterministic: boolean;
  /** Referenced event ordinal in conversation, e.g. "that incident" → last discussed. */
  refersToLastEvent: boolean;
}

const RULES: Array<{ intent: Intent; re: RegExp }> = [
  { intent: "EVIDENCE_REQUEST", re: /\b(prove|proof|evidence|show raw|raw data|verify this)\b/i },
  { intent: "SOURCE_REQUEST", re: /\b(open (the )?source|where (is|does) (this|that|it) (come|data)|original source|citation)\b/i },
  { intent: "MAP_REQUEST", re: /\b(show|open|put|draw).{0,24}(map)|(on the map|focus (the )?map|center the map)\b/i },
  { intent: "SCENARIO_ANALYSIS", re: /\b(what if|scenario|suppose|continues? for|another hour|next \d+ hours?)\b/i },
  { intent: "MEMORY_RECALL", re: /\b(have we seen|seen (this|that) before|last time|what happened last|previous (incident|event|time)|do you remember|related memories|what do you remember|what did (we|the city) learn)\b/i },
  { intent: "HISTORICAL_LOOKUP", re: /\b(last (week|month|monsoon)|in the past|previous (monsoon|year|episode)|historical)\b/i },
  { intent: "PATTERN_ANALYSIS", re: /\b(pattern|recurring|again and again|keeps? happening|trend)\b/i },
  { intent: "ANOMALY_ANALYSIS", re: /\b(anomaly|unusual|abnormal|why is traffic|deviation|baseline)\b/i },
  { intent: "CITY_LEARNING", re: /\b(city learning|lessons?|insights|learning dashboard)\b/i },
  { intent: "REMEMBER", re: /^\s*(remember |note this|keep this in mind|store this)/i },
  { intent: "FORGET", re: /\b(forget (this|that|it)|delete (this )?conversation|clear (this )?conversation)\b/i },
  { intent: "WEATHER", re: /\b(is it raining|raining|weather|temperature|humidity|forecast|monsoon|heat|aqi|air quality|smog|pollution)\b/i },
  { intent: "CURRENT_STATUS", re: /\b(what'?s? happening|status|right now|current situation|overview|anything new|active (events|incidents)|situation report)\b/i },
  { intent: "SEARCH_CONVERSATIONS", re: /\b(search (my )?conversations?|find (the )?conversation|past discussions?|previous chats?)\b/i },
];

/** Deterministic classifier — returns null when no rule matches confidently. */
export function detectIntent(message: string): IntentResult | null {
  const m = message.trim();
  if (!m) return null;
  const refersToLastEvent = /\b(this|that|it|there|the (incident|event|report))\b/i.test(m);

  for (const rule of RULES) {
    if (rule.re.test(m)) {
      return { intent: rule.intent, deterministic: true, refersToLastEvent };
    }
  }
  // Event lookup: mentions a known zone / district
  if (/\b(gachibowli|kukatpally|hitec|abids|nampally|charminar|uppal|secunderabad|kompally|shamshabad|attapur|old city|western corridor|central hyderabad|north hyderabad|east hyderabad|south hyderabad)\b/i.test(m)) {
    return { intent: "EVENT_LOOKUP", deterministic: true, refersToLastEvent };
  }
  return null; // → LLM classification fallback in chat.ts
}
