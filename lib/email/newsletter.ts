import "server-only";

import { sendMail } from "@/lib/email/smtp";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Wrap admin-authored newsletter HTML in a simple branded shell. */
export function wrapNewsletterHtml(opts: {
  subject: string;
  bodyHtml: string;
}): string {
  const body = opts.bodyHtml.trim();
  return `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#18181b">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:24px 12px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7">
            <tr>
            <td style="padding:20px 24px;background:#e05d38;color:#ffffff;font-size:18px;font-weight:600">
                Foodluk
              </td>
            </tr>
            <tr>
              <td style="padding:24px;font-size:15px;line-height:1.6">
                <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3">${escapeHtml(opts.subject)}</h1>
                <div>${body}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px;border-top:1px solid #e4e4e7;font-size:12px;color:#71717a">
                You are receiving this because you subscribed to Foodluk updates.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();
}

export async function sendNewsletterToSubscriber(opts: {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string | null;
}): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const html = wrapNewsletterHtml({
    subject: opts.subject,
    bodyHtml: opts.htmlBody,
  });
  return sendMail({
    to: opts.to,
    subject: opts.subject.startsWith("Foodluk")
      ? opts.subject
      : `Foodluk — ${opts.subject}`,
    html,
    text: opts.textBody ?? undefined,
    fromName: "Foodluk",
  });
}
