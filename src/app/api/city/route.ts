// GET /api/city?cityId= — operational summary for the command center header.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCityConfig } from "@/server/cities";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cityId = req.nextUrl.searchParams.get("cityId") ?? "hyderabad";
  const city = getCityConfig(cityId);
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);

  const [active, developing, resolved, total, liveTotal, simulatedTotal, userTotal] = await Promise.all([
    db.cityEvent.count({ where: { status: "ACTIVE", cityId } }),
    db.cityEvent.count({ where: { status: "DEVELOPING", cityId } }),
    db.cityEvent.count({ where: { status: "RESOLVED", cityId } }),
    db.cityEvent.count({ where: { cityId } }),
    db.cityEvent.count({ where: { dataOrigin: "LIVE", cityId } }),
    db.cityEvent.count({ where: { dataOrigin: "SIMULATED", cityId } }),
    db.cityEvent.count({ where: { dataOrigin: "USER_REPORTED", cityId } }),
  ]);

  const recent = await db.cityEvent.findMany({
    where: { observedAt: { gte: dayAgo }, cityId },
    orderBy: { observedAt: "desc" },
    take: 8,
  });

  return NextResponse.json({
    city: city.name,
    cityId,
    stats: {
      active,
      developing,
      resolved,
      total,
      byOrigin: { LIVE: liveTotal, SIMULATED: simulatedTotal, USER_REPORTED: userTotal },
    },
    recent: recent.map((e) => ({
      id: e.id,
      title: e.title,
      eventType: e.eventType,
      severity: e.severity,
      dataOrigin: e.dataOrigin,
      observedAt: e.observedAt.toISOString(),
    })),
    time: new Date().toISOString(),
  });
}
