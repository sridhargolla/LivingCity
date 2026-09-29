// GET /api/evidence?cityId=&origin=&limit= — evidence dashboard (PHASE 4).
// Evidence objects are built deterministically from stored events. No fabricated evidence, ever.
import { NextRequest, NextResponse } from "next/server";
import { collectEvidence } from "@/server/evidence";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const cityId = sp.get("cityId") ?? undefined;
  const origin = sp.get("origin"); // LIVE | USER_REPORTED | SIMULATED | HISTORICAL(alias for resolved)
  const limit = Math.min(Number(sp.get("limit") ?? 40) || 40, 100);

  const origins = origin && origin !== "HISTORICAL" ? [origin] : undefined;
  const evidence = await collectEvidence({ cityId, origins, limit });
  return NextResponse.json({ evidence, count: evidence.length });
}
