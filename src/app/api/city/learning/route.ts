// GET /api/city/learning?cityId= — City Learning dashboard (PHASE 11).
import { NextRequest, NextResponse } from "next/server";
import { getCityLearning } from "@/server/learning";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cityId = req.nextUrl.searchParams.get("cityId") ?? "hyderabad";
  const learning = await getCityLearning(cityId);
  return NextResponse.json(learning);
}
