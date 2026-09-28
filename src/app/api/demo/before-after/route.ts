// POST /api/demo/before-after — run the real before/after memory demonstration.
import { NextRequest, NextResponse } from "next/server";
import { runBeforeAfterDemo } from "@/server/demo/scenarios";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

const globalForDemo = globalThis as unknown as { __demoRunning?: boolean };

export async function POST(_req: NextRequest) {
  if (globalForDemo.__demoRunning) {
    return NextResponse.json({ error: "A demo run is already in progress." }, { status: 409 });
  }
  globalForDemo.__demoRunning = true;
  try {
    const result = await runBeforeAfterDemo();
    if (result.error) return NextResponse.json({ steps: result.steps, error: result.error }, { status: 503 });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  } finally {
    globalForDemo.__demoRunning = false;
  }
}
