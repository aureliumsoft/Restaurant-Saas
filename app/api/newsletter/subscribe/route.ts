import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";

const subscribeSchema = z.object({
  email: z.string().trim().email().max(200),
  name: z.string().trim().max(120).optional().nullable(),
  source: z.string().trim().max(60).optional().nullable(),
});

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = subscribeSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 }
    );
  }

  const email = parsed.data.email.toLowerCase();
  const name = parsed.data.name?.trim() || null;
  const source = parsed.data.source?.trim() || "footer";

  try {
    const existing = await db.newsletterSubscriber.findUnique({
      where: { email },
      select: { id: true, unsubscribedAt: true },
    });

    if (existing && !existing.unsubscribedAt) {
      return NextResponse.json(
        { data: { id: existing.id }, alreadySubscribed: true },
        { status: 200 }
      );
    }

    if (existing?.unsubscribedAt) {
      const row = await db.newsletterSubscriber.update({
        where: { email },
        data: {
          unsubscribedAt: null,
          name: name ?? undefined,
          source,
        },
        select: { id: true },
      });
      return NextResponse.json({ data: row, reactivated: true }, { status: 200 });
    }

    const row = await db.newsletterSubscriber.create({
      data: { email, name, source },
      select: { id: true },
    });

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (e) {
    console.error("[newsletter/subscribe]", e);
    return NextResponse.json(
      { error: "Could not subscribe right now. Please try again." },
      { status: 500 }
    );
  }
}
