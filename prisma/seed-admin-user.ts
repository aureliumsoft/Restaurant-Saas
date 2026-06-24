import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

import { seedDefaultGlobalRoles, SEED_GLOBAL_ROLE_SLUG } from './seed-roles';

const ADMIN_PASSWORD = '123456789';
const SALT_ROUNDS = 10;

const PLATFORM_ADMIN_USERS = [
  {
    email: 'ammaryounas0001@gmail.com',
    name: 'Platform Admin',
    username: 'ammaryounas_admin',
  },
  {
    email: 'cermicrip.uk@gmail.com',
    name: 'Platform Admin',
    username: 'cermicrip_admin',
  },
] as const;

async function upsertPlatformAdminUser(
  prisma: PrismaClient,
  adminRoleId: string,
  adminRoleName: string,
  user: (typeof PLATFORM_ADMIN_USERS)[number]
) {
  const email = user.email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS);

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        password: passwordHash,
        roleId: adminRoleId,
        emailVerified: new Date(),
      },
    });
    return;
  }

  await prisma.user.create({
    data: {
      name: user.name,
      username: user.username,
      email,
      password: passwordHash,
      emailVerified: new Date(),
      roleId: adminRoleId,
    },
  });

}

export async function seedPlatformAdminUser(prisma: PrismaClient) {
  const adminRole = await prisma.role.findFirst({
    where: { restaurantId: null, slug: SEED_GLOBAL_ROLE_SLUG.PLATFORM_ADMIN },
    select: { id: true, name: true },
  });

  if (!adminRole) {
    throw new Error(
      'platform_admin role not found. Run seedDefaultGlobalRoles first.'
    );
  }

  for (const user of PLATFORM_ADMIN_USERS) {
    await upsertPlatformAdminUser(prisma, adminRole.id, adminRole.name, user);
  }
}

async function main() {
  const prisma = new PrismaClient();
  try {
    await seedDefaultGlobalRoles(prisma);
    await seedPlatformAdminUser(prisma);
    
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
