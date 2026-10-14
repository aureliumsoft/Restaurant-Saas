import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getAdminEmails } from '@/lib/auth/admin';
import { resolveRestaurantIdForCustomRequest } from '@/lib/custom-plan-request-admin';
import { db } from '@/lib/db';
import { sendCustomPlanRequestEmail } from '@/lib/email/custom-plan-request';
import { PRICING_MODULE_ROWS } from '@/lib/pricing-comparison';

const MODULE_IDS = PRICING_MODULE_ROWS.map((r) => r.id);

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  restaurant: z.string().trim().min(2).max(200),
  restaurantId: z.string().trim().min(1).max(64).optional().nullable(),
  selectedModules: z
    .array(z.string().trim().min(1).max(64))
    .min(1)
    .max(MODULE_IDS.length),
});

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const selected = [
    ...new Set(
      parsed.data.selectedModules.filter((id) => MODULE_IDS.includes(id))
    ),
  ];
  if (selected.length === 0) {
    return NextResponse.json(
      { error: 'Select at least one module' },
      { status: 400 }
    );
  }

  const moduleLabels = selected.map((id) => {
    const row = PRICING_MODULE_ROWS.find((r) => r.id === id);
    return row?.label ?? id;
  });

  const email = parsed.data.email.toLowerCase();
  const restaurantId = await resolveRestaurantIdForCustomRequest({
    restaurantId: parsed.data.restaurantId,
    restaurantName: parsed.data.restaurant,
    email,
  });

  try {
    const row = await db.customPlanRequest.create({
      data: {
        name: parsed.data.name,
        email,
        restaurantName: parsed.data.restaurant,
        restaurantId,
        selectedModules: selected,
        status: 'PENDING',
      },
      select: { id: true },
    });

    const recipients = getAdminEmails();
    if (recipients.length > 0) {
      const sent = await sendCustomPlanRequestEmail({
        to: recipients,
        name: parsed.data.name,
        email,
        restaurantName: parsed.data.restaurant,
        selectedModules: moduleLabels,
      });
      if (!sent.ok) {
        console.error('[api/custom-plan-request] email failed', sent.error);
      }
    } else {
      console.warn(
        '[api/custom-plan-request] ADMIN_EMAIL(S) not set — request stored only'
      );
    }

    return NextResponse.json({ data: row }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Failed to submit custom plan request' },
      { status: 500 }
    );
  }
}
