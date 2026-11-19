import { NextResponse } from 'next/server';
import { z } from 'zod';

import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { ensureGlobalSignupRolesExist } from '@/lib/ensure-global-signup-roles';
import { GLOBAL_ROLE_SLUG, getGlobalRoleIdBySlug } from '@/lib/global-roles';
import { createRestaurantWithDefaults } from '@/lib/onboarding/create-restaurant';
import { prismaErrorMessage, prismaErrorStatus } from '@/lib/prisma-errors';

const signupSchema = z.object({
  name: z
    .string({ required_error: 'Full name is required.' })
    .trim()
    .min(2, 'Full name must be at least 2 characters.')
    .max(120, 'Full name must be at most 120 characters.'),
  email: z
    .string({ required_error: 'Email is required.' })
    .trim()
    .email('Enter a valid email address.'),
  password: z
    .string({ required_error: 'Password is required.' })
    .min(8, 'Password must be at least 8 characters.')
    .max(200, 'Password must be at most 200 characters.'),
  restaurantName: z
    .string({ required_error: 'Restaurant name is required.' })
    .trim()
    .min(2, 'Restaurant name must be at least 2 characters.')
    .max(120, 'Restaurant name must be at most 120 characters.'),
  subdomain: z
    .string({ required_error: 'Web address is required.' })
    .trim()
    .min(2, 'Web address must be at least 2 characters.')
    .max(50, 'Web address must be at most 50 characters.')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
      message: 'Use lowercase letters, numbers, and single hyphens only.',
    }),
});

function usernameFromEmail(email: string): string {
  const base =
    email
      .split('@')[0]
      .replace(/[^a-zA-Z0-9_]/g, '')
      .slice(0, 20) || 'owner';
  return `${base}_${Math.random().toString(36).slice(2, 6)}`;
}

export async function POST(req: Request) {
  const json = await req.json();
  const parsed = signupSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, email, password, restaurantName, subdomain } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: 'Email is already in use.' },
      { status: 409 }
    );
  }

  const taken = await db.restaurant.findFirst({
    where: { OR: [{ slug: subdomain }, { subdomain }] },
    select: { id: true },
  });
  if (taken) {
    return NextResponse.json(
      { error: 'That web address is already taken. Try another.' },
      { status: 409 }
    );
  }

  await ensureGlobalSignupRolesExist();
  const ownerRoleId = await getGlobalRoleIdBySlug(GLOBAL_ROLE_SLUG.PENDING_OWNER);
  if (!ownerRoleId) {
    return NextResponse.json(
      { error: 'Owner role is missing. Run seed.' },
      { status: 503 }
    );
  }

  const passwordHash = await hashPassword(password);
  const user = await db.user.create({
    data: {
      name,
      username: usernameFromEmail(email),
      email,
      password: passwordHash,
      roleId: ownerRoleId,
      image: null,
      emailVerified: new Date(),
    },
  });

  try {
    const restaurant = await createRestaurantWithDefaults({
      name: restaurantName,
      subdomain,
      ownerUserId: user.id,
    });
    return NextResponse.json({ ok: true, userId: user.id, restaurantId: restaurant.id });
  } catch (error) {
    await db.user.delete({ where: { id: user.id } }).catch(() => undefined);
    console.error('[signup] restaurant create failed:', error);
    return NextResponse.json(
      { error: prismaErrorMessage(error) },
      { status: prismaErrorStatus(error) }
    );
  }
}
