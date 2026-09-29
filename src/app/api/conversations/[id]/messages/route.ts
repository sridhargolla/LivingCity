// POST /api/conversations/[id]/messages — "Ask the City" (PHASES 2, 5, 6, 7).
// Stores the user message, runs the copilot (deterministic intents first, LLM where
// useful, Hindsight when memory is relevant), stores the assistant reply with
// structured actions/evidence, returns it. Conversation memory ≠ city memory.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { askTheCity } from "@/server/agent/chat";
import { getCityConfig } from "@/server/cities";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MsgSchema = z.object({
  message: z.string().min(1).max(1000),
  selectedEventId: z.string().max(64).nullable().optional(),
});

// naive per-IP rate limit: 30 messages / 5 min
const globalForRL = globalThis as unknown as { __chatRL?: Map<string, number[]> };
const rl = (globalForRL.__chatRL ??= new Map());
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const window = 5 * 60 * 1000;
  const hits = (rl.get(ip) ?? []).filter((t) => now - t < window);
  hits.push(now);
  rl.set(ip, hits);
  return hits.length > 30;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "Too many messages. Try again in a few minutes." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = MsgSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid message" }, { status: 400 });

  const conv = await db.conversation.findUnique({ where: { id }, include: { _count: { select: { messages: true } } } });
  if (!conv) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  const city = getCityConfig(conv.cityId);

  // store user message
  const userMsg = await db.conversationMessage.create({
    data: { conversationId: id, role: "user", content: parsed.data.message },
  });

  // first user message titles the conversation
  if (conv._count.messages === 0) {
    const title = parsed.data.message.slice(0, 60) + (parsed.data.message.length > 60 ? "…" : "");
    await db.conversation.update({ where: { id }, data: { title } }).catch(() => undefined);
  }

  try {
    const reply = await askTheCity({
      cityId: conv.cityId,
      conversationId: id,
      message: parsed.data.message,
      selectedEventId: parsed.data.selectedEventId ?? null,
    });

    const assistantMsg = await db.conversationMessage.create({
      data: {
        conversationId: id,
        role: "assistant",
        content: reply.answer,
        intent: reply.intent,
        actions: JSON.stringify(reply.actions),
        eventRefs: JSON.stringify(reply.eventRefs),
        memoryRefs: JSON.stringify(reply.memoryRefs),
        evidenceRefs: JSON.stringify(reply.evidence),
        degraded: reply.degraded,
      },
    });
    await db.conversation.update({ where: { id }, data: { updatedAt: new Date() } });

    return NextResponse.json({
      ok: true,
      userMessage: { id: userMsg.id, role: "user", content: userMsg.content, createdAt: userMsg.createdAt.toISOString() },
      assistantMessage: {
        id: assistantMsg.id,
        role: "assistant",
        content: reply.answer,
        intent: reply.intent,
        actions: reply.actions,
        eventRefs: reply.eventRefs,
        memoryRefs: reply.memoryRefs,
        evidence: reply.evidence,
        degraded: reply.degraded,
        transferred: reply.transferred ?? null,
        createdAt: assistantMsg.createdAt.toISOString(),
      },
      city: { cityId: city.cityId, name: city.name },
    });
  } catch (e) {
    // Even on failure, keep the conversation usable and honest.
    const fallback = await db.conversationMessage.create({
      data: {
        conversationId: id,
        role: "assistant",
        content: "The copilot hit an internal error handling that message. Deterministic data is still available on the dashboard; please try again.",
        degraded: true,
      },
    });
    console.error("[chat] askTheCity failed", e);
    return NextResponse.json({
      ok: true,
      userMessage: { id: userMsg.id, role: "user", content: userMsg.content, createdAt: userMsg.createdAt.toISOString() },
      assistantMessage: { id: fallback.id, role: "assistant", content: fallback.content, degraded: true, actions: [], eventRefs: [], memoryRefs: [], evidence: [], createdAt: fallback.createdAt.toISOString() },
    });
  }
}
