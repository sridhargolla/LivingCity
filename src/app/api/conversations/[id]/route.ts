// GET    /api/conversations/[id]  → full conversation with messages
// PATCH  /api/conversations/[id]  → rename
// DELETE /api/conversations/[id]  → delete (local conversation memory only)
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const conv = await db.conversation.findUnique({
    where: { id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    conversation: {
      id: conv.id,
      title: conv.title,
      cityId: conv.cityId,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString(),
      messages: conv.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        intent: m.intent,
        actions: safeParse(m.actions, []),
        eventRefs: safeParse(m.eventRefs, []),
        memoryRefs: safeParse(m.memoryRefs, []),
        evidenceRefs: safeParse(m.evidenceRefs, []),
        degraded: m.degraded,
        createdAt: m.createdAt.toISOString(),
      })),
    },
  });
}

const PatchSchema = z.object({ title: z.string().min(1).max(120) });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid title" }, { status: 400 });

  try {
    const conv = await db.conversation.update({ where: { id }, data: { title: parsed.data.title } });
    return NextResponse.json({ ok: true, title: conv.title });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    await db.conversation.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

function safeParse(raw: string, fallback: unknown): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
