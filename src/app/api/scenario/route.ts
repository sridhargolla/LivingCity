// POST /api/scenario — What-If scenario analysis (PHASE 13).
// OBSERVED | HISTORICAL | SCENARIO labels on every consideration. Never a prediction.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runScenario } from "@/server/scenario";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const ScenarioInput = z.object({
  cityId: z.string().max(40).default("hyderabad"),
  eventId: z.string().max(64).nullable().optional(),
  question: z.string().min(5).max(400),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = ScenarioInput.safeParse(body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).slice(0, 3).join("; ");
    return NextResponse.json({ error: `Validation failed — ${issues}` }, { status: 400 });
  }

  try {
    const result = await runScenario({
      cityId: parsed.data.cityId,
      eventId: parsed.data.eventId ?? null,
      question: parsed.data.question,
    });
    return NextResponse.json({ ok: true, scenario: result }, { status: 201 });
  } catch (e) {
    console.error("[scenario] run failed", e);
    return NextResponse.json({ error: "Scenario analysis failed. Try again." }, { status: 500 });
  }
}
