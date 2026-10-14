import { getAppBaseUrl } from '@/lib/app-base-url';
import { sendMail } from '@/lib/email/smtp';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function sendCustomPlanRequestEmail(opts: {
  to: string[];
  name: string;
  email: string;
  restaurantName: string;
  selectedModules: string[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { to, name, email, restaurantName, selectedModules } = opts;
  if (to.length === 0) {
    return { ok: false, error: 'No recipient addresses configured.' };
  }

  const safeName = name.length > 80 ? `${name.slice(0, 80)}…` : name;
  const subject = `Foodluk — Custom plan request: ${safeName}`;
  const site = getAppBaseUrl();
  const modulesHtml =
    selectedModules.length > 0
      ? `<ul>${selectedModules
          .map((m) => `<li>${escapeHtml(m)}</li>`)
          .join('')}</ul>`
      : '<p>—</p>';

  const html = `
    <p>New <strong>Custom plan</strong> request from the Foodluk pricing page.</p>
    <table style="border-collapse:collapse;font-size:14px">
      <tr><td style="padding:4px 12px 4px 0;font-weight:600">Site</td><td>${escapeHtml(site)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;font-weight:600">Name</td><td>${escapeHtml(name)}</td></tr>
      <tr><td style="padding:4px 12px 4px 0;font-weight:600">Email</td><td><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
      <tr><td style="padding:4px 12px 4px 0;font-weight:600">Restaurant</td><td>${escapeHtml(restaurantName)}</td></tr>
    </table>
    <p style="margin-top:16px;font-weight:600">Selected modules</p>
    ${modulesHtml}
  `.trim();

  const result = await sendMail({
    to,
    subject,
    html,
    replyTo: email,
    fromName: 'Foodluk',
  });

  if (!result.ok) {
    console.error('[custom-plan-request] SMTP error', {
      to,
      message: result.error,
    });
    return { ok: false, error: result.error };
  }

  return { ok: true };
}
