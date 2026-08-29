import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/auth/adminRequest";
import { db } from "@/lib/db";
import { resolveRouteParams } from '@/lib/resolve-route-id';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const auth = await requirePlatformAdmin(req);
  if ("error" in auth) return auth.error;

  const { id } = await resolveRouteParams(ctx.params, ['id']);
  try {
    const campaign = await db.newsletterCampaign.findUnique({
      where: { id },
      select: {
        id: true,
        subject: true,
        htmlBody: true,
        textBody: true,
        buttonTitle: true,
        buttonLink: true,
        status: true,
        recipientCount: true,
        successCount: true,
        failureCount: true,
        sentByEmail: true,
        sentAt: true,
        createdAt: true,
      },
    });
    if (!campaign) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({
      data: {
        ...campaign,
        sentAt: campaign.sentAt.toISOString(),
        createdAt: campaign.createdAt.toISOString(),
      },
    });
  } catch (e) {
    console.error("[admin/newsletter/campaign GET]", e);
    return NextResponse.json(
      { error: "Failed to load message" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = await requirePlatformAdmin(req);
  if ("error" in auth) return auth.error;

  const { id } = await resolveRouteParams(ctx.params, ['id']);
  try {
    await db.newsletterCampaign.delete({ where: { id } });
    return NextResponse.json({ data: { ok: true } });
  } catch (e) {
    console.error("[admin/newsletter/campaign DELETE]", e);
    return NextResponse.json(
      { error: "Failed to delete message" },
      { status: 500 }
    );
  }
}
