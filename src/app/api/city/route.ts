// GET /api/city — operational summary for the command center header.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);

  const [active, developing, resolved, total, liveTotal, simulatedTotal, userTotal] = await Promise.all([
    db.cityEvent.count({ where: { status: "ACTIVE" } }),
    db.cityEvent.count({ where: { status: "DEVELOPING" } }),
    db.cityEvent.count({ where: { status: "RESOLVED" } }),
    db.cityEvent.count(),
    db.cityEvent.count({ where: { dataOrigin: "LIVE" } }),
    db.cityEvent.count({ where: { dataOrigin: "SIMULATED" } }),
    db.cityEvent.count({ where: { dataOrigin: "USER_REPORTED" } }),
  ]);

  const recent = await db.cityEvent.findMany({
    where: { observedAt: { gte: dayAgo } },
    orderBy: { observedAt: "desc" },
    take: 8,
  });

  return NextResponse.json({
    city: "Hyderabad",
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
