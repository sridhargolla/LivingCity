// Conversations API (PHASE 5) — persistent, searchable discussions.
// GET    /api/conversations?cityId=&q=   → list (search by title or message content)
// POST   /api/conversations {cityId}     → create a new discussion
// DELETE /api/conversations?cityId=      → privacy control: delete ALL conversations for a city
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest) {
  const cityId = req.nextUrl.searchParams.get("cityId") ?? "hyderabad";
  const deleted = await db.conversation.deleteMany({ where: { cityId } });
  return NextResponse.json({ ok: true, deleted: deleted.count });
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const cityId = sp.get("cityId") ?? "hyderabad";
  const q = (sp.get("q") ?? "").trim().slice(0, 100);

  const conversations = await db.conversation.findMany({
    where: {
      cityId,
      ...(q
        ? {
            OR: [{ title: { contains: q } }, { messages: { some: { content: { contains: q } } } }],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
  });

  return NextResponse.json({
    conversations: conversations.map((c) => ({
      id: c.id,
      title: c.title,
      cityId: c.cityId,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      lastMessagePreview: c.messages[0]?.content.slice(0, 120) ?? "",
    })),
  });
}

const CreateSchema = z.object({ cityId: z.string().max(40).default("hyderabad"), title: z.string().max(120).optional() });

export async function POST(req: NextRequest) {
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine
  }
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const conv = await db.conversation.create({
    data: { cityId: parsed.data.cityId, title: parsed.data.title ?? "New discussion" },
  });
  return NextResponse.json({ ok: true, conversation: { id: conv.id, title: conv.title, cityId: conv.cityId } }, { status: 201 });
}
