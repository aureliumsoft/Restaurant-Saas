import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { requirePlatformAdmin } from "@/lib/auth/adminRequest";
import { db } from "@/lib/db";

const patchSchema = z.object({
  plan: z.enum(["FREE", "BASIC", "GROWTH", "SCALE", "PRO", "CUSTOM"]),
  name: z.string().trim().min(1).max(120),
  price: z.number().int().min(0),
  priceLabel: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(500),
  features: z.array(z.string().trim().min(1).max(120)).max(20),
});

export async function GET(req: NextRequest) {
  const auth = await requirePlatformAdmin(req);
  if ("error" in auth) return auth.error;

  try {
    const rows = await db.$queryRaw<
      Array<{
        id: string;
        plan: string;
        name: string;
        price: number;
        priceLabel: string;
        description: string;
        features: string[] | null;
      }>
    >(Prisma.sql`
      SELECT "id","plan"::text AS "plan","name","price","priceLabel","description","features"
      FROM "SubscriptionCatalog"
      ORDER BY CASE "plan"
        WHEN 'FREE' THEN 1
        WHEN 'BASIC' THEN 2
        WHEN 'GROWTH' THEN 3
        WHEN 'SCALE' THEN 4
        WHEN 'PRO' THEN 5
        WHEN 'CUSTOM' THEN 6
        ELSE 99
      END
    `);

    return NextResponse.json({ data: rows }, { status: 200 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load pricing plans" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requirePlatformAdmin(req);
  if ("error" in auth) return auth.error;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const features = parsed.data.features.filter((f) => f.trim() !== "");

  try {
    const row = await db.$queryRaw<
      Array<{
        id: string;
        plan: string;
        name: string;
        price: number;
        priceLabel: string;
        description: string;
        features: string[] | null;
      }>
    >(Prisma.sql`
      INSERT INTO "SubscriptionCatalog" ("id","plan","name","price","priceLabel","description","features","createdAt","updatedAt")
      VALUES (${`subcat_${parsed.data.plan.toLowerCase()}`}, ${parsed.data.plan}::"SubscriptionPlan", ${parsed.data.name}, ${parsed.data.price}, ${parsed.data.priceLabel}, ${parsed.data.description}, ${features}, now(), now())
      ON CONFLICT ("plan")
      DO UPDATE SET
        "name" = EXCLUDED."name",
        "price" = EXCLUDED."price",
        "priceLabel" = EXCLUDED."priceLabel",
        "description" = EXCLUDED."description",
        "features" = EXCLUDED."features",
        "updatedAt" = now()
      RETURNING "id","plan"::text AS "plan","name","price","priceLabel","description","features"
    `);

    return NextResponse.json({ data: row[0] ?? null }, { status: 200 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to update pricing plan" }, { status: 500 });
  }
}
