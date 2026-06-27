import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requirePlatformAdmin } from '@/lib/auth/adminRequest';
import { db } from '@/lib/db';
import { sendDemoRequestReplyEmail } from '@/lib/email/demo-request-reply';

type RouteContext = {
  params: Promise<{ requestId: string }>;
};

export async function POST(req: NextRequest, context: RouteContext) {
  const auth = await requirePlatformAdmin(req);
  if ('error' in auth) return auth.error;

  const { requestId } = await context.params;
  if (!requestId?.trim()) {
    return NextResponse.json({ error: 'Request id is required.' }, { status: 400 });
  }

  const row = await db.demoRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      name: true,
      email: true,
      restaurantName: true,
    },
  });

  if (!row) {
    return NextResponse.json({ error: 'Demo request not found.' }, { status: 404 });
  }

  const result = await sendDemoRequestReplyEmail({
    name: row.name,
    email: row.email,
    restaurantName: row.restaurantName,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        smtpMissing: result.smtpMissing ?? false,
      },
      { status: result.smtpMissing ? 503 : 500 }
    );
  }

  return NextResponse.json(
    { data: { messageId: result.messageId } },
    { status: 200 }
  );
}
