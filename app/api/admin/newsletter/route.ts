import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/auth/adminRequest";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const auth = await requirePlatformAdmin(req);
  if ("error" in auth) return auth.error;

  try {
    const [subscribers, campaigns, activeCount, campaignTotal] = await Promise.all([
      db.newsletterSubscriber.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          name: true,
          source: true,
          unsubscribedAt: true,
          createdAt: true,
        },
      }),
      db.newsletterCampaign.findMany({
        orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
        take: 50,
        select: {
          id: true,
          subject: true,
          recipientCount: true,
          successCount: true,
          failureCount: true,
          sentByEmail: true,
          sentAt: true,
          status: true,
          buttonTitle: true,
          buttonLink: true,
        },
      }),
      db.newsletterSubscriber.count({
        where: { unsubscribedAt: null },
      }),
      db.newsletterCampaign.count(),
    ]);

    return NextResponse.json(
      {
        data: {
          activeCount,
          campaignTotal,
          subscribers: subscribers.map((s) => ({
            ...s,
            createdAt: s.createdAt.toISOString(),
            unsubscribedAt: s.unsubscribedAt?.toISOString() ?? null,
          })),
          campaigns: campaigns.map((c) => ({
            ...c,
            sentAt: c.sentAt.toISOString(),
          })),
        },
      },
      { status: 200 }
    );
  } catch (e) {
    console.error("[admin/newsletter GET]", e);
    return NextResponse.json(
      { error: "Failed to load newsletter data" },
      { status: 500 }
    );
  }
}
