// GET /api/city/state?cityId= — operator dashboard cards with PROVENANCE (LIVE/SIMULATED/NO_DATA).
import { NextRequest, NextResponse } from "next/server";
import { getCityState } from "@/server/simulator";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cityId = req.nextUrl.searchParams.get("cityId") ?? "hyderabad";
  const state = await getCityState(cityId);
  return NextResponse.json(state);
}
