import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * PayPal return/cancel landing page for the native app WebView.
 * Flutter intercepts this URL and then captures the PayPal order.
 */
export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get('status')?.trim() || 'success';
  const cancelled = status === 'cancel' || status === 'cancelled';
  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${cancelled ? 'Payment cancelled' : 'Payment complete'}</title>
  </head>
  <body data-payment="${cancelled ? 'cancel' : 'success'}">
    <p>${cancelled ? 'Payment cancelled. You can return to the app.' : 'Payment complete. Return to the app.'}</p>
  </body>
</html>`;
  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
