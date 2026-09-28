// Simulator API — autonomous SIMULATED incidents + manual scenario triggers.
// GET  /api/simulator → status
// POST /api/simulator { action: "start"|"stop"|"trigger", cityId?, scenario?, intervalMs? }
// Every event produced here is data_origin=SIMULATED. Always labeled.
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { startSimulator, stopSimulator, simulatorStatus, triggerScenario, SCENARIO_KEYS, SCENARIO_LABELS } from "@/server/simulator";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ status: simulatorStatus(), scenarios: SCENARIO_KEYS.map((k) => ({ key: k, label: SCENARIO_LABELS[k] })) });
}

const BodySchema = z.object({
  action: z.enum(["start", "stop", "trigger"]),
  cityId: z.string().max(40).default("hyderabad"),
  scenario: z.enum(SCENARIO_KEYS).optional(),
  intervalMs: z.number().int().min(30000).max(600000).optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  switch (parsed.data.action) {
    case "start": {
      const s = startSimulator(parsed.data.cityId, parsed.data.intervalMs);
      return NextResponse.json({ ok: true, status: simulatorStatus(), ...s });
    }
    case "stop":
      return NextResponse.json({ ok: true, status: stopSimulator() });
    case "trigger": {
      const r = await triggerScenario(parsed.data.cityId, parsed.data.scenario ?? SCENARIO_KEYS[Math.floor(Math.random() * SCENARIO_KEYS.length)]);
      if (!r) return NextResponse.json({ error: "Scenario produced no event (deduplicated or rejected). Try a different scenario." }, { status: 409 });
      return NextResponse.json({ ok: true, scenario: r.scenario, eventIds: r.eventIds, status: simulatorStatus() });
    }
  }
}
