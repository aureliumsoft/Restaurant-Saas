import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { requirePlatformAdmin } from '@/lib/auth/adminRequest';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const auth = await requirePlatformAdmin(req);
  if ('error' in auth) return auth.error;

  try {
    const rows = await db.customPlanRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        restaurant: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    return NextResponse.json(
      {
        data: rows.map((r) => ({
          id: r.id,
          name: r.name,
          email: r.email,
          restaurantName: r.restaurantName,
          restaurantId: r.restaurantId,
          restaurant: r.restaurant,
          selectedModules: r.selectedModules,
          status: r.status,
          reviewedAt: r.reviewedAt?.toISOString() ?? null,
          createdAt: r.createdAt.toISOString(),
        })),
      },
      { status: 200 }
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Failed to load custom plan requests' },
      { status: 500 }
    );
  }
}
