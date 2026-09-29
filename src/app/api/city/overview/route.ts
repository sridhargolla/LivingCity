// GET /api/city/overview?cityId= — one shared live-city snapshot for all pages.
import { NextRequest, NextResponse } from "next/server";
import { getCityOverview } from "@/server/conditions";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cityId = req.nextUrl.searchParams.get("cityId") ?? "hyderabad";
  try {
    const overview = await getCityOverview(cityId);
    return NextResponse.json(overview);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "overview failed" },
      { status: 500 }
    );
  }
}
