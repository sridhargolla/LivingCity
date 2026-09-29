// GET /api/memory/operations — recent memory operations for the visible memory panel.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 12) || 12, 50);
  const ops = await db.memoryOperation.findMany({ orderBy: { createdAt: "desc" }, take: limit });

  return NextResponse.json({
    operations: ops.map((o) => {
      let detail: Record<string, unknown> = {};
      try {
        detail = JSON.parse(o.detail);
      } catch {}
      return {
        id: o.id,
        eventId: o.eventId,
        operation: o.operation,
        status: o.status,
        resultCount: o.resultCount,
        query: o.query,
        detail,
        createdAt: o.createdAt.toISOString(),
      };
    }),
  });
}
