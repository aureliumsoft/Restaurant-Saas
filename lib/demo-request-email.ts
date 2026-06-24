import {
  DEMO_OWNER_EMAIL,
  DEMO_OWNER_PASSWORD,
} from '@/lib/demo-restaurant';
import { getPublicAppOrigin } from '@/lib/public-app-origin';

export type DemoReplyEmailParams = {
  name: string;
  email: string;
  restaurantName: string;
};

export function getDemoLoginUrl(origin?: string): string {
  const base = (origin ?? getPublicAppOrigin()).replace(/\/$/, '');
  return `${base}/login`;
}

function buildPlainBody(
  params: DemoReplyEmailParams,
  loginUrl: string
): string {
  return [
    `Hi ${params.name},`,
    '',
    `Thank you for requesting a demo for ${params.restaurantName}.`,
    '',
    'You can explore our demo restaurant using the credentials below:',
    '',
    `Sign in: ${loginUrl}`,
    `Email: ${DEMO_OWNER_EMAIL}`,
    `Password: ${DEMO_OWNER_PASSWORD}`,
    '',
    'Check your email for updates about your request. Reply to this message if you need help getting started.',
    '',
    'Best regards,',
    'FoodLuk Team',
  ].join('\n');
}

export function buildDemoReplyMailto(
  params: DemoReplyEmailParams,
  origin?: string
): string {
  const loginUrl = getDemoLoginUrl(origin);
  const subject = encodeURIComponent('Your FoodLuk demo access');
  const body = encodeURIComponent(buildPlainBody(params, loginUrl));
  return `mailto:${encodeURIComponent(params.email)}?subject=${subject}&body=${body}`;
}

export function buildDemoReplyEmailHtml(
  params: DemoReplyEmailParams,
  origin?: string
): string {
  const loginUrl = getDemoLoginUrl(origin);
  const esc = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  return `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #18181b;">
  <p>Hi ${esc(params.name)},</p>
  <p>Thank you for requesting a demo for <strong>${esc(params.restaurantName)}</strong>.</p>
  <p>You can sign in below to explore our demo restaurant:</p>
  <p style="margin: 24px 0;">
    <a href="${esc(loginUrl)}" style="display: inline-block; background: #e85d04; color: #ffffff; text-decoration: none; font-weight: 600; padding: 12px 24px; border-radius: 8px;">
      Sign in to demo
    </a>
  </p>
  <p><strong>Demo credentials</strong></p>
  <ul>
    <li>Email: <code>${esc(DEMO_OWNER_EMAIL)}</code></li>
    <li>Password: <code>${esc(DEMO_OWNER_PASSWORD)}</code></li>
  </ul>
  <p>Check your email for updates about your request.</p>
  <p>Best regards,<br>FoodLuk Team</p>
</body>
</html>`;
}
