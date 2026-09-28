// POST /api/events/[id]/feedback — human confirmation/rejection (PHASE 12).
// CONFIRMED → retain an operator-confirmed experience into the city's Hindsight bank.
// REJECTED  → retain a correction so the system does not repeat the unsupported inference.
// Verdicts are always stored and visibly attributed to a human.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { publish } from "@/server/realtime/eventBus";
import { HindsightMemoryService } from "@/server/hindsight/HindsightMemoryService";
import { bankIdForCity, getCityConfig } from "@/server/cities";
import { sanitizeUntrusted } from "@/server/llm/reasoning";

export const dynamic = "force-dynamic";

const FeedbackSchema = z.object({
  verdict: z.enum(["CONFIRMED", "REJECTED", "INVESTIGATE", "DISMISSED"]),
  observation: z.string().max(1000).default(""),
  note: z.string().max(500).default(""),
  analysisId: z.string().max(64).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = FeedbackSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid feedback" }, { status: 400 });

  const event = await db.cityEvent.findUnique({ where: { id }, include: { analyses: true } });
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const feedback = await db.humanFeedback.create({
    data: {
      eventId: id,
      analysisId: parsed.data.analysisId ?? event.analyses[0]?.id ?? null,
      verdict: parsed.data.verdict,
      observation: sanitizeUntrusted(parsed.data.observation).slice(0, 800),
      note: sanitizeUntrusted(parsed.data.note).slice(0, 400),
    },
  });

  // Retain confirmation/correction into the city's own bank (tagged human-feedback).
  let retained = false;
  if (parsed.data.verdict === "CONFIRMED" || parsed.data.verdict === "REJECTED") {
    const city = getCityConfig(event.cityId);
    const isConfirmed = parsed.data.verdict === "CONFIRMED";
    const observation = parsed.data.observation || event.analyses[0]?.summary || event.title;
    const fact = isConfirmed
      ? `HUMAN CONFIRMATION (${city.name}, ${new Date().toISOString().slice(0, 16)} UTC): A city operator CONFIRMED this assessment for "${event.title}": "${observation.slice(0, 300)}".${parsed.data.note ? ` Operator note: ${parsed.data.note.slice(0, 200)}.` : ""} Confirmed observations can be treated as vetted operational experience for this city.`
      : `HUMAN CORRECTION (${city.name}, ${new Date().toISOString().slice(0, 16)} UTC): A city operator REJECTED this assessment for "${event.title}": "${observation.slice(0, 300)}".${parsed.data.note ? ` Reason: ${parsed.data.note.slice(0, 200)}.` : ""} Do not repeat this unsupported inference for similar situations without new local evidence.`;

    const res = await HindsightMemoryService.retain_event_experience({
      eventId: event.id,
      fact,
      context: `Living City human feedback — ${city.name}`,
      occurredAt: new Date(),
      tags: ["human-feedback", isConfirmed ? "confirmed" : "correction", `city:${event.cityId}`, `type:${event.eventType}`],
      metadata: { eventId: event.id, cityId: event.cityId, verdict: parsed.data.verdict, feedbackId: feedback.id },
      bankId: bankIdForCity(event.cityId),
    });
    retained = res.success;
    if (res.success) {
      await db.humanFeedback.update({ where: { id: feedback.id }, data: { retainedToMemory: true } });
    }
  }

  publish("feedback.recorded", {
    eventId: id,
    feedbackId: feedback.id,
    verdict: parsed.data.verdict,
    retained,
  });

  return NextResponse.json({ ok: true, feedbackId: feedback.id, retainedToMemory: retained }, { status: 201 });
}
