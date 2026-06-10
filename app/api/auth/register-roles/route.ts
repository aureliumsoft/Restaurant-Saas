import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { REGISTER_ROLE_SLUG } from '@/lib/global-roles';

const REGISTER_LABEL: Record<string, string> = {
  [REGISTER_ROLE_SLUG.OWNER]: 'Owner',
  [REGISTER_ROLE_SLUG.WORKER]: 'Worker',
};

const REGISTER_ORDER = [
  REGISTER_ROLE_SLUG.OWNER,
  REGISTER_ROLE_SLUG.WORKER,
] as const;

/**
 * Roles offered on the public register form: Owner and Worker
 * (`pending_owner` / `pending_worker` global roles).
 */
export async function GET() {
  const slugs = Object.values(REGISTER_ROLE_SLUG);

  const rows = await db.role.findMany({
    where: {
      restaurantId: null,
      slug: { in: slugs },
    },
    select: { id: true, name: true, slug: true },
  });

  const roles = REGISTER_ORDER.flatMap((slug) => {
    const row = rows.find((r) => r.slug === slug);
    if (!row) return [];
    return [
      {
        id: row.id,
        slug: row.slug,
        name: REGISTER_LABEL[slug] ?? row.name,
      },
    ];
  });

  return NextResponse.json({ roles });
}
