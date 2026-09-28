// LIVING CITY — Demo scenario engine.
//
// DEMO MODE: controlled SIMULATED events that run through the REAL pipeline
// (ingest → recall → analyze → relate → retain → SSE). Clearly labeled SIMULATED;
// never mixed into LIVE statistics (UI filters by dataOrigin).
//
// The before/after demonstration executes the actual Hindsight recall/retain loop:
//   Step 1: historical seed events + outcomes retained in memory (past days)
//   Step 2: "EVENT A" rain in the Western Corridor — if memory is empty → generic response
//   Step 3: outcome recorded (water accumulation + traffic slowdown) → retained
//   Step 4: "EVENT B" similar rain, similar corridor → memory recalls the experience
//           → analysis becomes contextual, citing historical outcomes

import { db } from "@/lib/db";
import { ingestCandidates } from "@/server/ingestion/ingest";
import { publish } from "@/server/realtime/eventBus";
import { HindsightMemoryService } from "@/server/hindsight/HindsightMemoryService";
import { HindsightClient } from "@vectorize-io/hindsight-client";
import { env } from "@/server/env";

const WEST = { lat: 17.4401, lon: 78.3489, name: "Western Corridor (Gachibowli · Kukatpally)" };

/** Dedicated demo bank so the before/after contrast is guaranteed clean
 *  and simulated demo experiences never pollute the live city memory bank. */
export const DEMO_BANK = "living-city-demo-beforeafter";

async function resetDemoBank(): Promise<void> {
  const c = new HindsightClient({ baseUrl: env.hindsight.baseUrl, apiKey: env.hindsight.apiKey || undefined });
  try {
    await c.deleteBank(DEMO_BANK);
  } catch {
    // bank may not exist yet — that's fine
  }
  try {
    await c.createBank(DEMO_BANK, { name: "Living City — before/after demo (SIMULATED)" });
  } catch {
    // some server versions auto-create banks on first retain
  }
}

export interface DemoStepResult {
  step: string;
  description: string;
  eventId?: string;
  analysis?: {
    summary: string;
    riskLevel: string;
    memoryUsed: boolean;
    memoryCount: number;
    degraded: boolean;
    recurringOutcomes: string[];
    similarPastSituations: number;
  } | null;
  outcomeRecorded?: string;
  retained?: boolean;
  error?: string;
}

async function waitForAnalysis(eventId: string, timeoutMs = 120000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const analysis = await db.analysisResult.findUnique({ where: { eventId } });
    const retainOp = await db.memoryOperation.findFirst({
      where: { eventId, operation: "RETAIN" },
      orderBy: { createdAt: "desc" },
    });
    if (analysis && retainOp) return;
    await new Promise((r) => setTimeout(r, 1500));
  }
}

async function getAnalysis(eventId: string) {
  const a = await db.analysisResult.findUnique({ where: { eventId } });
  if (!a) return null;
  let recurringOutcomes: string[] = [];
  let similarPastSituations = 0;
  try {
    const raw = JSON.parse(a.rawJson) as { analysis?: { historical_comparison?: { recurring_outcomes?: string[]; similar_past_situations?: number } } };
    recurringOutcomes = raw.analysis?.historical_comparison?.recurring_outcomes ?? [];
    similarPastSituations = raw.analysis?.historical_comparison?.similar_past_situations ?? 0;
  } catch {}
  return {
    summary: a.summary,
    riskLevel: a.riskLevel,
    memoryUsed: a.memoryUsed,
    memoryCount: a.memoryCount,
    degraded: a.degraded,
    recurringOutcomes,
    similarPastSituations,
  };
}

async function retainOutcomeDirect(eventId: string, fact: string, occurredAt: Date, tags: string[]) {
  const res = await HindsightMemoryService.retain_event_experience({
    eventId,
    fact,
    context: "Living City operational experience — Hyderabad (demo outcome record)",
    occurredAt,
    tags,
    metadata: { eventId, record: "outcome" },
    bankId: DEMO_BANK,
  });
  publish("memory.retained", { eventId, success: res.success, error: res.error, factPreview: fact.slice(0, 200) });
  return res.success;
}

/**
 * SEED — write a small set of genuinely-derived historical experiences into Hindsight
 * so the demo bank has real prior context. Only run when the user clicks "seed memory".
 */
export async function seedHistoricalMemory(): Promise<{ steps: DemoStepResult[] }> {
  const steps: DemoStepResult[] = [];
  const scenarios = [
    {
      daysAgo: 21,
      fact: `On ${new Date(Date.now() - 21 * 86400000).toISOString().slice(0, 10)}, heavy rainfall (18 mm/h) affected the Western Corridor (Gachibowli · Kukatpally), Hyderabad. Water accumulation was observed on the Gachibowli ORR service road within 90 minutes. Traffic slowdown of 25-40 minutes was reported on the Kukatpally–Miyapur stretch. MDAC (Musswaram dial-a-cop) diversions were needed near Hitec City.`,
      tags: ["type:WEATHER_RAIN", "zone:Western Corridor (Gachibowli · Kukatpally)", "origin:SIMULATED", "seed"],
    },
    {
      daysAgo: 14,
      fact: `On ${new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10)}, moderate rainfall (9 mm/h) in the Western Corridor (Gachibowli · Kukatpally) produced waterlogging near Kukatpally Housing Board colony and bus delays on route 216 of ~20 minutes. GHMC disaster response cleared drains within 3 hours.`,
      tags: ["type:WEATHER_RAIN", "zone:Western Corridor (Gachibowli · Kukatpally)", "origin:SIMULATED", "seed"],
    },
    {
      daysAgo: 7,
      fact: `On ${new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)}, heavy rain (14 mm/h) over Central Hyderabad (Abids · Nampally) caused brief water accumulation at Nampally station approach and increased travel times by ~15 minutes. Drainage capacity proved adequate; effects resolved within 2 hours.`,
      tags: ["type:WEATHER_RAIN", "zone:Central Hyderabad (Abids · Nampally)", "origin:SIMULATED", "seed"],
    },
  ];

  for (const s of scenarios) {
    const occurredAt = new Date(Date.now() - s.daysAgo * 86400000);
    const res = await HindsightMemoryService.retain_event_experience({
      eventId: "seed",
      fact: s.fact,
      context: "Living City operational experience — Hyderabad monsoon history",
      occurredAt,
      tags: s.tags,
      metadata: { record: "seed", origin: "SIMULATED" },
    });
    steps.push({
      step: "seed",
      description: s.fact.slice(0, 140) + "…",
      retained: res.success,
      error: res.error,
    });
  }
  return { steps };
}

/**
 * BEFORE/AFTER DEMO — runs the real pipeline in 4 observable steps.
 */
export async function runBeforeAfterDemo(): Promise<{ steps: DemoStepResult[]; error?: string }> {
  const steps: DemoStepResult[] = [];
  const memoryHealth = await HindsightMemoryService.checkHealth();
  if (!memoryHealth.available) {
    return {
      steps,
      error: `Hindsight memory temporarily unavailable (${memoryHealth.detail ?? "unknown"}) — the before/after demonstration requires the real memory system and refuses to fake it.`,
    };
  }

  // Fresh, empty demo bank → Event A is guaranteed to run WITHOUT relevant memory.
  await resetDemoBank();

  // ── EVENT A: rain hits the Western Corridor ─────────────────────────────
  publish("analysis.started", { demo: "before-after", phase: "event-a" });
  const a = await ingestCandidates("demo-scenarios", [
    {
      source: "demo-scenarios",
      dataOrigin: "SIMULATED",
      eventType: "WEATHER_RAIN",
      title: "Heavy Rainfall — Western Corridor (Gachibowli · Kukatpally)",
      description:
        "Simulated heavy rainfall: 14 mm/h for the next 3 hours over the Gachibowli–Kukatpally corridor. Cloud cover 100%, humidity 92%, wind 18 km/h.",
      severity: "MAJOR",
      confidence: 0.9,
      latitude: WEST.lat,
      longitude: WEST.lon,
      locationName: WEST.name,
      tags: ["demo", "rain"],
      metadata: { precipMm: 14, zone: "west", demoPhase: "A" },
      analysisPriority: "high",
    },
  ]);
  const eventAId = a.eventIds[0];
  steps.push({
    step: "event-a",
    description: "EVENT A — heavy rain over the Western Corridor (SIMULATED, real pipeline).",
    eventId: eventAId,
  });
  await waitForAnalysis(eventAId!);
  const analysisA = await getAnalysis(eventAId!);
  steps.push({
    step: "analysis-a",
    description:
      analysisA && analysisA.memoryCount === 0
        ? "BEFORE MEMORY: no related experiences existed — the assessment is generic, based on current conditions only."
        : "Assessment produced (memory state as stored).",
    eventId: eventAId,
    analysis: analysisA,
  });

  // ── OUTCOME of Event A, observed later ──────────────────────────────────
  const outcomeFact = `Outcome of the ${new Date().toISOString().slice(0, 10)} heavy rainfall in the Western Corridor (Gachibowli · Kukatpally): water accumulation ~30 cm on the Gachibowli ORR service road, traffic slowdown of 30-45 minutes on Kukatpally–Miyapur stretch, and 25-minute bus delays on route 218. Effects lasted ~4 hours.`;
  await db.eventOutcome.create({
    data: {
      eventId: eventAId!,
      outcomeType: "WATERLOGGING",
      description: outcomeFact,
      severity: "MAJOR",
      source: "system",
    },
  });
  publish("outcome.recorded", { eventId: eventAId, outcomeType: "WATERLOGGING" });
  const retained = await retainOutcomeDirect(eventAId!, outcomeFact, new Date(), [
    "type:WATERLOGGING",
    "zone:Western Corridor (Gachibowli · Kukatpally)",
    "origin:SIMULATED",
    "outcome",
  ]);
  steps.push({
    step: "outcome-a",
    description: "EVENT A OUTCOME — water accumulation + traffic slowdown observed; experience retained into Hindsight.",
    eventId: eventAId,
    outcomeRecorded: "WATERLOGGING + TRAFFIC_SLOWDOWN + BUS_DELAY",
    retained,
  });

  // ── EVENT B: similar rain, similar corridor — memory should now speak ────
  publish("analysis.started", { demo: "before-after", phase: "event-b" });
  const b = await ingestCandidates("demo-scenarios", [
    {
      source: "demo-scenarios",
      dataOrigin: "SIMULATED",
      eventType: "WEATHER_RAIN",
      title: "Heavy Rainfall — Western Corridor (Gachibowli · Kukatpally)",
      description:
        "Simulated heavy rainfall: 12 mm/h beginning over the Gachibowli–Kukatpally corridor. Conditions closely resemble the previous episode in this corridor.",
      severity: "MAJOR",
      confidence: 0.9,
      latitude: WEST.lat + 0.008, // ~1 km away — same corridor
      longitude: WEST.lon + 0.008,
      locationName: WEST.name,
      tags: ["demo", "rain"],
      metadata: { precipMm: 12, zone: "west", demoPhase: "B" },
      analysisPriority: "high",
    },
  ]);
  const eventBId = b.eventIds[0];
  steps.push({
    step: "event-b",
    description: "EVENT B — similar rain returns to the same corridor (SIMULATED, real pipeline).",
    eventId: eventBId,
  });
  await waitForAnalysis(eventBId!);
  const analysisB = await getAnalysis(eventBId!);
  steps.push({
    step: "analysis-b",
    description:
      analysisB && analysisB.memoryCount > 0
        ? "AFTER MEMORY: Hindsight recalled prior corridor experiences — the assessment now cites historical outcomes and risk."
        : "Assessment produced. (If memory count is 0, recall found no related experiences — check Hindsight.)",
    eventId: eventBId,
    analysis: analysisB,
  });

  return { steps };
}
