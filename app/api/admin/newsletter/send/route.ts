import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePlatformAdmin } from "@/lib/auth/adminRequest";
import { db } from "@/lib/db";
import { sendNewsletterToSubscriber } from "@/lib/email/newsletter";
import { getSmtpConfigError } from "@/lib/email/smtp";

const sendSchema = z.object({
  subject: z.string().trim().min(3).max(200),
  htmlBody: z.string().trim().min(10).max(50_000),
  textBody: z.string().trim().max(50_000).optional().nullable(),
});

export async function POST(req: NextRequest) {
  const auth = await requirePlatformAdmin(req);
  if ("error" in auth) return auth.error;

  const smtpError = getSmtpConfigError();
  if (smtpError) {
    return NextResponse.json(
      { error: `Email is not configured: ${smtpError}` },
      { status: 503 }
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = sendSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Subject and message body are required." },
      { status: 400 }
    );
  }

  const { subject, htmlBody, textBody } = parsed.data;

  try {
    const subscribers = await db.newsletterSubscriber.findMany({
      where: { unsubscribedAt: null },
      select: { id: true, email: true },
      orderBy: { createdAt: "asc" },
    });

    if (subscribers.length === 0) {
      return NextResponse.json(
        { error: "There are no active subscribers to email." },
        { status: 400 }
      );
    }

    let successCount = 0;
    let failureCount = 0;
    const errors: string[] = [];

    for (const sub of subscribers) {
      const result = await sendNewsletterToSubscriber({
        to: sub.email,
        subject,
        htmlBody,
        textBody,
      });
      if (result.ok) {
        successCount += 1;
      } else {
        failureCount += 1;
        if (errors.length < 5) {
          errors.push(`${sub.email}: ${result.error}`);
        }
      }
    }

    const campaign = await db.newsletterCampaign.create({
      data: {
        subject,
        htmlBody,
        textBody: textBody ?? null,
        status: failureCount === subscribers.length ? "FAILED" : "SENT",
        recipientCount: subscribers.length,
        successCount,
        failureCount,
        sentByEmail: auth.email,
      },
      select: {
        id: true,
        subject: true,
        recipientCount: true,
        successCount: true,
        failureCount: true,
        sentAt: true,
        status: true,
      },
    });

    return NextResponse.json(
      {
        data: {
          ...campaign,
          sentAt: campaign.sentAt.toISOString(),
          errors: errors.length > 0 ? errors : undefined,
        },
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("[admin/newsletter/send]", e);
    return NextResponse.json(
      { error: "Failed to send newsletter" },
      { status: 500 }
    );
  }
}
