import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/auth/adminRequest";
import { db } from "@/lib/db";
import { resolveRouteParams } from '@/lib/resolve-route-id';

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ subscriberId: string }> }
) {
  const auth = await requirePlatformAdmin(req);
  if ("error" in auth) return auth.error;

  const { subscriberId } = await resolveRouteParams(ctx.params, ['subscriberId']);
  if (!subscriberId) {
    return NextResponse.json({ error: "Missing subscriber id" }, { status: 400 });
  }

  try {
    const existing = await db.newsletterSubscriber.findUnique({
      where: { id: subscriberId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Subscriber not found" }, { status: 404 });
    }

    await db.newsletterSubscriber.update({
      where: { id: subscriberId },
      data: { unsubscribedAt: new Date() },
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error("[admin/newsletter DELETE]", e);
    return NextResponse.json(
      { error: "Failed to unsubscribe" },
      { status: 500 }
    );
  }
}
