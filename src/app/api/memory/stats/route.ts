// GET /api/memory/stats — the LEARNING INDICATOR. Real numbers only.
// Memory count comes from the actual Hindsight bank via listMemories.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { HindsightMemoryService } from "@/server/hindsight/HindsightMemoryService";
import { HindsightClient } from "@vectorize-io/hindsight-client";
import { env } from "@/server/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const hindsight = await HindsightMemoryService.checkHealth();

  let bankMemoryCount: number | null = null;
  if (hindsight.available) {
    try {
      const c = new HindsightClient({ baseUrl: env.hindsight.baseUrl, apiKey: env.hindsight.apiKey || undefined });
      const res = await c.listMemories(env.hindsight.bankId, { limit: 1 });
      bankMemoryCount = res.total;
    } catch {
      bankMemoryCount = null;
    }
  }

  const [memoryOps, retains, recalls, lastRetain] = await Promise.all([
    db.memoryOperation.count({ where: { status: "SUCCESS" } }),
    db.memoryOperation.count({ where: { operation: "RETAIN", status: "SUCCESS" } }),
    db.memoryOperation.count({ where: { operation: "RECALL", status: "SUCCESS" } }),
    db.memoryOperation.findFirst({ where: { operation: "RETAIN" }, orderBy: { createdAt: "desc" } }),
  ]);

  const [patterns, relationships, events] = await Promise.all([
    db.eventRelationship.count({ where: { relation: "RECURRING_PATTERN" } }),
    db.eventRelationship.count(),
    db.cityEvent.count(),
  ]);

  return NextResponse.json({
    cityMemory: {
      hindsightAvailable: hindsight.available,
      hindsightVersion: hindsight.version ?? null,
      bankId: env.hindsight.bankId,
      memoryOperations: memoryOps,
      eventsRemembered: events,
      retains,
      recalls,
      patternsDiscovered: patterns,
      relationshipsMapped: relationships,
      lastMemoryUpdate: lastRetain ? lastRetain.createdAt.toISOString() : null,
      lastMemoryUpdateStatus: lastRetain?.status ?? null,
      bankMemoryCount,
    },
  });
}
