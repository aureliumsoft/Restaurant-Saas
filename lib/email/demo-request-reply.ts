import 'server-only';

import { getAppBaseUrl } from '@/lib/app-base-url';
import {
  buildDemoReplyEmailHtml,
  buildDemoReplyPlainText,
  DEMO_REPLY_EMAIL_SUBJECT,
  type DemoReplyEmailParams,
} from '@/lib/demo-request-email';
import {
  getSmtpConfigError,
  isSmtpConfigured,
  sendMail,
} from '@/lib/email/smtp';

export type DemoRequestReplySendResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string; smtpMissing?: boolean };

export async function sendDemoRequestReplyEmail(
  params: DemoReplyEmailParams
): Promise<DemoRequestReplySendResult> {
  if (!isSmtpConfigured()) {
    return {
      ok: false,
      smtpMissing: true,
      error: getSmtpConfigError() ?? 'SMTP is not configured.',
    };
  }

  const origin = getAppBaseUrl();
  const html = buildDemoReplyEmailHtml(params, origin);
  const text = buildDemoReplyPlainText(params, origin);

  const result = await sendMail({
    to: params.email,
    subject: DEMO_REPLY_EMAIL_SUBJECT,
    html,
    text,
    fromName: 'FoodLuk',
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  return { ok: true, messageId: result.messageId };
}
