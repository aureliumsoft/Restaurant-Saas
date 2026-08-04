import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePlatformAdmin } from "@/lib/auth/adminRequest";
import { saveAndBroadcastNewsletter } from "@/lib/newsletter/broadcast";
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
    const result = await saveAndBroadcastNewsletter({
      subject,
      htmlBody,
      textBody,
      sentByEmail: auth.email,
    });

    return NextResponse.json(
      {
        data: {
          id: result.campaignId,
          subject: result.subject,
          recipientCount: result.recipientCount,
          successCount: result.successCount,
          failureCount: result.failureCount,
          sentAt: result.sentAt.toISOString(),
          status: result.status,
          errors: result.errors.length > 0 ? result.errors : undefined,
        },
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("[admin/newsletter/send]", e);
    return NextResponse.json(
      { error: "Failed to save and send newsletter" },
      { status: 500 }
    );
  }
}
