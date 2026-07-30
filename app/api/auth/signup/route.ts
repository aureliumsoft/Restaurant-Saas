import { NextResponse } from 'next/server';
import { z } from 'zod';

import { db } from '@/lib/db';
import { hashPassword, isStrongPassword } from '@/lib/auth/password';
import { GLOBAL_ROLE_SLUG, REGISTER_ROLE_SLUG, getGlobalRoleIdBySlug } from '@/lib/global-roles';

const signupSchema = z.object({
  name: z
    .string({ required_error: 'Full name is required.' })
    .min(2, 'Full name must be at least 2 characters.')
    .max(120, 'Full name must be at most 120 characters.'),
  username: z
    .string({ required_error: 'Username is required.' })
    .min(2, 'Username must be at least 2 characters.')
    .max(60, 'Username must be at most 60 characters.'),
  email: z
    .string({ required_error: 'Email is required.' })
    .email('Enter a valid email address.'),
  password: z
    .string({ required_error: 'Password is required.' })
    .min(8, 'Password must be at least 8 characters.')
    .max(200, 'Password must be at most 200 characters.'),
  roleId: z
    .string()
    .uuid('Select a valid role.')
    .optional(),
});

export async function POST(req: Request) {
  const json = await req.json();
  const parsed = signupSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, username, email, password, roleId } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: 'Email is already in use.' },
      { status: 409 }
    );
  }

  const allowedSlugs = new Set(Object.values(REGISTER_ROLE_SLUG));
  let resolvedRoleId: string | null = null;
  if (roleId) {
    const accountRole = await db.role.findFirst({
      where: {
        id: roleId,
        restaurantId: null,
        slug: { in: [...allowedSlugs] },
      },
      select: { id: true },
    });
    if (!accountRole) {
      return NextResponse.json(
        { error: 'Invalid or unavailable role selected.' },
        { status: 400 }
      );
    }
    resolvedRoleId = accountRole.id;
  } else {
    resolvedRoleId = await getGlobalRoleIdBySlug(GLOBAL_ROLE_SLUG.CUSTOMER_USER);
    if (!resolvedRoleId) {
      return NextResponse.json(
        { error: 'Default User role is missing. Run seed.' },
        { status: 503 }
      );
    }
  }

  const passwordHash = await hashPassword(password);

  const user = await db.user.create({
    data: {
      name,
      username,
      email,
      password: passwordHash,
      roleId: resolvedRoleId,
      image: null,
      emailVerified: new Date(),
    },
  });

  return NextResponse.json({ ok: true, userId: user.id });
}
