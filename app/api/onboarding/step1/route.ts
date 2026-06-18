import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { legacyRoleFromAccountRole } from "@/lib/auth/account-role";
import { db } from "@/lib/db";
import { ensureGlobalSignupRolesExist } from "@/lib/ensure-global-signup-roles";
import { GLOBAL_ROLE_SLUG, getGlobalRoleIdBySlug } from "@/lib/global-roles";
import { getSessionEmail, getSessionUserId } from "@/lib/onboarding/auth";
import { createRestaurantWithDefaults } from "@/lib/onboarding/create-restaurant";
import { prismaErrorMessage, prismaErrorStatus } from "@/lib/prisma-errors";
import { ensurePresetRolesAndOwnerEmployee } from "@/lib/restaurant-roles";

const bodySchema = z.object({
  name: z.string().min(2).max(120),
  subdomain: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
      message:
        "Domain must be lowercase letters, numbers, and single hyphens only.",
    }),
});

function slugifySubdomain(raw: string) {
  return raw.trim().toLowerCase();
}

async function loadOwnerUser(email: string) {
  let user = await db.user.findUnique({
    where: { email },
    include: {
      accountRole: { select: { slug: true, name: true, restaurantId: true } },
    },
  });
  if (!user) return null;

  if (legacyRoleFromAccountRole(user.accountRole ?? null) === "OWNER") {
    return user;
  }

  await ensureGlobalSignupRolesExist();
  const pendingOwnerId = await getGlobalRoleIdBySlug(
    GLOBAL_ROLE_SLUG.PENDING_OWNER
  );
  if (!pendingOwnerId) return null;

  await db.user.update({
    where: { id: user.id },
    data: { roleId: pendingOwnerId },
  });

  user = await db.user.findUnique({
    where: { email },
    include: {
      accountRole: { select: { slug: true, name: true, restaurantId: true } },
    },
  });
  if (
    !user ||
    legacyRoleFromAccountRole(user.accountRole ?? null) !== "OWNER"
  ) {
    return null;
  }
  return user;
}

export async function POST(req: NextRequest) {
  try {
    const email = await getSessionEmail(req);
    const userId = await getSessionUserId(req);
    if (!email || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await loadOwnerUser(email);
    if (!user) {
      return NextResponse.json(
        {
          error:
            "Only restaurant owners can complete onboarding. Sign up as Owner or contact support.",
        },
        { status: 403 }
      );
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const subdomain = slugifySubdomain(parsed.data.subdomain);
    const name = parsed.data.name.trim();

    const existingOwned = await db.restaurant.findFirst({
      where: { ownerId: user.id },
    });
    if (existingOwned) {
      await ensurePresetRolesAndOwnerEmployee(existingOwned.id, user.id);
      return NextResponse.json(
        {
          restaurant: existingOwned,
          message: "You already have a restaurant.",
        },
        { status: 200 }
      );
    }

    const taken = await db.restaurant.findFirst({
      where: {
        OR: [{ slug: subdomain }, { subdomain }],
      },
    });
    if (taken) {
      return NextResponse.json(
        { error: "That domain name is already taken. Try another." },
        { status: 409 }
      );
    }

    await ensureGlobalSignupRolesExist();

    const restaurant = await createRestaurantWithDefaults({
      name,
      subdomain,
      ownerUserId: user.id,
    });

    return NextResponse.json({ restaurant }, { status: 201 });
  } catch (error) {
    console.error("[onboarding/step1] failed:", error);
    return NextResponse.json(
      { error: prismaErrorMessage(error) },
      { status: prismaErrorStatus(error) }
    );
  }
}
