import "server-only";

import { db } from "@/lib/db";
import { sendNewsletterToSubscriber } from "@/lib/email/newsletter";

export type NewsletterMessage = {
  id: string;
  subject: string;
  htmlBody: string;
  textBody: string | null;
};

/** Most recent campaign saved by admin (latest message for new subscribers). */
export async function getLatestNewsletterMessage(): Promise<NewsletterMessage | null> {
  const row = await db.newsletterCampaign.findFirst({
    orderBy: { sentAt: "desc" },
    select: {
      id: true,
      subject: true,
      htmlBody: true,
      textBody: true,
    },
  });
  return row;
}

export type BroadcastResult = {
  campaignId: string;
  subject: string;
  recipientCount: number;
  successCount: number;
  failureCount: number;
  status: string;
  sentAt: Date;
  errors: string[];
};

/**
 * Save a newsletter message and email every active subscriber.
 * Still stores the message when there are zero subscribers (for welcome emails).
 */
export async function saveAndBroadcastNewsletter(opts: {
  subject: string;
  htmlBody: string;
  textBody?: string | null;
  sentByEmail: string | null;
}): Promise<BroadcastResult> {
  const subscribers = await db.newsletterSubscriber.findMany({
    where: { unsubscribedAt: null },
    select: { email: true },
    orderBy: { createdAt: "asc" },
  });

  let successCount = 0;
  let failureCount = 0;
  const errors: string[] = [];

  for (const sub of subscribers) {
    const result = await sendNewsletterToSubscriber({
      to: sub.email,
      subject: opts.subject,
      htmlBody: opts.htmlBody,
      textBody: opts.textBody,
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

  const status =
    subscribers.length === 0
      ? "SAVED"
      : failureCount === subscribers.length
        ? "FAILED"
        : "SENT";

  const campaign = await db.newsletterCampaign.create({
    data: {
      subject: opts.subject,
      htmlBody: opts.htmlBody,
      textBody: opts.textBody ?? null,
      status,
      recipientCount: subscribers.length,
      successCount,
      failureCount,
      sentByEmail: opts.sentByEmail,
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

  return {
    campaignId: campaign.id,
    subject: campaign.subject,
    recipientCount: campaign.recipientCount,
    successCount: campaign.successCount,
    failureCount: campaign.failureCount,
    status: campaign.status,
    sentAt: campaign.sentAt,
    errors,
  };
}

/** Email the latest stored newsletter to one address (new/reactivated subscriber). */
export async function sendLatestNewsletterToEmail(
  email: string
): Promise<{ sent: boolean; reason?: string }> {
  const latest = await getLatestNewsletterMessage();
  if (!latest) {
    return { sent: false, reason: "no_message" };
  }

  const result = await sendNewsletterToSubscriber({
    to: email,
    subject: latest.subject,
    htmlBody: latest.htmlBody,
    textBody: latest.textBody,
  });

  if (!result.ok) {
    console.error("[newsletter] welcome send failed", email, result.error);
    return { sent: false, reason: result.error };
  }
  return { sent: true };
}
