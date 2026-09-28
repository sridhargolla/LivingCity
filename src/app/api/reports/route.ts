// POST /api/reports — operator/user incident report.
// Flow: VALIDATION → SANITIZATION → EVENT CREATION → HINDSIGHT RECALL → ANALYSIS
//       → DATABASE → HINDSIGHT RETAIN → SSE BROADCAST
// All fields are untrusted input: zod-validated, sanitized, rate-limited.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ingestCandidates } from "@/server/ingestion/ingest";
import { isWithinHyderabad, sanitizeText } from "@/server/ingestion/normalize";
import { nearestZone } from "@/server/types";
import { publish } from "@/server/realtime/eventBus";
import { getCityConfig } from "@/server/cities";

export const dynamic = "force-dynamic";

// ── naive per-IP rate limit: 10 reports / 10 min ────────────────────────────
const globalForRL = globalThis as unknown as { __reportRL?: Map<string, number[]> };
const rl = (globalForRL.__reportRL ??= new Map());
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const window = 10 * 60 * 1000;
  const hits = (rl.get(ip) ?? []).filter((t) => now - t < window);
  hits.push(now);
  rl.set(ip, hits);
  return hits.length > 10;
}

const ReportSchema = z.object({
  cityId: z.string().max(40).default("hyderabad"),
  description: z.string().min(10).max(2000),
  category: z.enum([
    "WATERLOGGING",
    "FLOODING_REPORT",
    "TRAFFIC_DISRUPTION",
    "ROAD_INCIDENT",
    "INFRASTRUCTURE",
    "PUBLIC_SAFETY",
    "POWER_OUTAGE",
    "BUS_DELAY",
    "USER_REPORT",
  ]),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  locationName: z.string().min(2).max(200).optional(),
  severity: z.enum(["MINOR", "MODERATE", "MAJOR", "CRITICAL"]).default("MODERATE"),
});

// zone centroids operators can pick from when they don't provide coordinates
const ZONE_POINTS: Record<string, { lat: number; lon: number; name: string }> = {
  west: { lat: 17.4401, lon: 78.3489, name: "Western Corridor (Gachibowli · Kukatpally)" },
  central: { lat: 17.3850, lon: 78.4867, name: "Central Hyderabad (Abids · Nampally)" },
  north: { lat: 17.5400, lon: 78.4900, name: "North Hyderabad (Kompally · Alwal)" },
  east: { lat: 17.4000, lon: 78.5600, name: "East Hyderabad (Uppal · Ghatkesar)" },
  oldcity: { lat: 17.3616, lon: 78.4747, name: "Old City (Charminar · Falaknuma)" },
  secunderabad: { lat: 17.4399, lon: 78.4983, name: "Secunderabad (Paradise · Tarnaka)" },
  south: { lat: 17.2403, lon: 78.4294, name: "South Hyderabad (Shamshabad · Attapur)" },
};

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "Too many reports from this address. Try again later." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ReportSchema.safeParse(body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).slice(0, 3).join("; ");
    return NextResponse.json({ error: `Validation failed — ${issues}` }, { status: 400 });
  }

  const data = parsed.data;
  if (data.description && /<script|javascript:|on\w+=/i.test(data.description)) {
    return NextResponse.json({ error: "Report contains disallowed content" }, { status: 400 });
  }

  let lat: number | null = null;
  let lon: number | null = null;
  let locationName = sanitizeText(data.locationName ?? "", 200);
  const cityCfg = getCityConfig(data.cityId);

  if (typeof data.latitude === "number" && typeof data.longitude === "number") {
    // Hyderabad uses the strict operational-area check; other configured cities use a
    // generous bounds window around the city center (no fabricated precision).
    const inBounds =
      data.cityId === "hyderabad"
        ? isWithinHyderabad(data.latitude, data.longitude)
        : Math.abs(data.latitude - cityCfg.latitude) < 0.75 && Math.abs(data.longitude - cityCfg.longitude) < 0.75;
    if (!inBounds) {
      return NextResponse.json(
        { error: `Coordinates are outside the ${cityCfg.name} operational area` },
        { status: 400 }
      );
    }
    lat = data.latitude;
    lon = data.longitude;
    if (!locationName) locationName = data.cityId === "hyderabad" ? nearestZone(lat, lon).name : `${cityCfg.name} district area`;
  }

  const zone = ZONE_POINTS.west;
  if (lat === null && !locationName) locationName = data.cityId === "hyderabad" ? zone.name : `${cityCfg.name} (citywide)`;

  const title = `${data.category === "USER_REPORT" ? "Operator Report" : data.category.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())} — ${locationName}`;

  const result = await ingestCandidates("report-portal", [
    {
      source: "report-portal",
      dataOrigin: "USER_REPORTED",
      cityId: data.cityId,
      eventType: data.category,
      title,
      description: sanitizeText(data.description, 2000),
      latitude: lat,
      longitude: lon,
      locationName: locationName || "Hyderabad",
      severity: data.severity,
      confidence: 0.7, // user reports carry inherent uncertainty
      status: "ACTIVE",
      tags: ["user-report", data.category.toLowerCase()],
      metadata: { submittedBy: "operator-portal", reportChannel: "web" },
      analysisPriority: "high",
    },
  ]);

  if (result.accepted === 0) {
    // Either a duplicate or invalid — differentiate for honest UX
    return NextResponse.json(
      { error: "Report matches an existing active event for this area today (deduplicated), or was invalid." },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true, eventId: result.eventIds[0], deduplicated: result.duplicates }, { status: 201 });
}
