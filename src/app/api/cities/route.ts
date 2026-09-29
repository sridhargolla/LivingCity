// GET /api/cities — configured cities (multi-city architecture, PHASE 14).
import { NextResponse } from "next/server";
import { CITY_REGISTRY } from "@/server/cities";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    cities: CITY_REGISTRY.map((c) => ({
      cityId: c.cityId,
      name: c.name,
      country: c.country,
      timezone: c.timezone,
      latitude: c.latitude,
      longitude: c.longitude,
      primary: c.primary,
      providers: c.providers,
    })),
  });
}
