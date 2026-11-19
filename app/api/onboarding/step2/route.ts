import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { legacyRoleFromAccountRole } from "@/lib/auth/account-role";
import { db } from "@/lib/db";
import { estimateDataUrlBytes, isAcceptedImageValue } from "@/lib/image-data-url";
import { getSessionEmail } from "@/lib/onboarding/auth";

const bodySchema = z
  .object({
    restaurantId: z.string().min(1),
    logoUrl: z.string().max(2_800_000).optional().or(z.literal("")),
    mainBannerUrl: z.string().max(2_800_000).optional().or(z.literal("")),
    menuBannerUrls: z.array(z.string().max(2_800_000)).max(20).optional(),
  })
  .superRefine((val, ctx) => {
    const check = (label: string, v: string | undefined, path: (string | number)[]) => {
      if (!v || !v.trim()) return;
      if (!isAcceptedImageValue(v)) {
        ctx.addIssue({
          code: "custom",
          message: `${label} must be an http/https URL or base64 image`,
          path,
        });
        return;
      }
      if (v.startsWith("data:image/") && estimateDataUrlBytes(v) > 2 * 1024 * 1024) {
        ctx.addIssue({
          code: "custom",
          message: `${label} base64 image must be <= 2MB`,
          path,
        });
      }
    };
    check("Logo", val.logoUrl, ["logoUrl"]);
    check("Main banner", val.mainBannerUrl, ["mainBannerUrl"]);
    (val.menuBannerUrls ?? []).forEach((u, i) => check("Menu banner", u, ["menuBannerUrls", i]));
  });

export async function PATCH(req: NextRequest) {
  const email = await getSessionEmail(req);
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { email },
    include: {
      accountRole: { select: { slug: true, name: true, restaurantId: true } },
    },
  });
  if (
    !user ||
    legacyRoleFromAccountRole(user.accountRole ?? null) !== "OWNER"
  ) {
    return NextResponse.json({ error: "Access Blocked" }, { status: 403 });
  }

  const json = await req.json();
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { restaurantId, logoUrl, mainBannerUrl, menuBannerUrls } =
    parsed.data;

  const restaurant = await db.restaurant.findFirst({
    where: { id: restaurantId, ownerId: user.id },
  });
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found." }, { status: 404 });
  }

  const menuUrls = (menuBannerUrls ?? []).map((u) => u.trim()).filter(Boolean);

  const updated = await db.restaurant.update({
    where: { id: restaurantId },
    data: {
      logoUrl: logoUrl?.trim() ? logoUrl.trim() : null,
      mainBannerUrl: mainBannerUrl?.trim() ? mainBannerUrl.trim() : null,
      menuBannerUrls: menuUrls,
    },
  });

  return NextResponse.json({ restaurant: updated });
}
