import "server-only";

import { db } from "@/lib/db";
import { sendLatestNewsletterToEmail } from "@/lib/newsletter/broadcast";
import { getSmtpConfigError } from "@/lib/email/smtp";

export type UpsertNewsletterSubscriberResult = {
  id: string;
  alreadySubscribed: boolean;
  reactivated: boolean;
};

async function maybeSendLatestWelcome(email: string) {
  if (getSmtpConfigError()) return;
  try {
    await sendLatestNewsletterToEmail(email);
  } catch (e) {
    console.error("[newsletter/subscribe] welcome email", e);
  }
}

/** Add or keep an active newsletter subscriber. Does not fail the caller. */
export async function upsertNewsletterSubscriber(opts: {
  email: string;
  name?: string | null;
  source?: string | null;
}): Promise<UpsertNewsletterSubscriberResult | null> {
  const email = opts.email.trim().toLowerCase();
  if (!email || !email.includes("@")) return null;
  const name = opts.name?.trim() || null;
  const source = opts.source?.trim() || "footer";

  try {
    const existing = await db.newsletterSubscriber.findUnique({
      where: { email },
      select: { id: true, unsubscribedAt: true },
    });

    if (existing && !existing.unsubscribedAt) {
      if (name) {
        await db.newsletterSubscriber.update({
          where: { email },
          data: { name },
        });
      }
      return { id: existing.id, alreadySubscribed: true, reactivated: false };
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
      await maybeSendLatestWelcome(email);
      return { id: row.id, alreadySubscribed: false, reactivated: true };
    }

    const row = await db.newsletterSubscriber.create({
      data: { email, name, source },
      select: { id: true },
    });
    await maybeSendLatestWelcome(email);
    return { id: row.id, alreadySubscribed: false, reactivated: false };
  } catch (e) {
    console.error("[newsletter/subscribe]", e);
    return null;
  }
}
