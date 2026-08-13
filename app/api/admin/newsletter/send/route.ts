import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { requirePlatformAdmin } from "@/lib/auth/adminRequest";
import { getSmtpConfigError } from "@/lib/email/smtp";
import { saveAndBroadcastNewsletter } from "@/lib/newsletter/broadcast";
import {
  newsletterSendSchema,
  normalizeNewsletterSendInput,
} from "@/lib/newsletter/newsletter";

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

  const parsed = newsletterSendSchema.safeParse(json);
  if (!parsed.success) {
    const msg =
      parsed.error.issues[0]?.message ??
      "Subject and message body are required.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const payload = normalizeNewsletterSendInput(parsed.data);

  try {
    const result = await saveAndBroadcastNewsletter({
      ...payload,
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
