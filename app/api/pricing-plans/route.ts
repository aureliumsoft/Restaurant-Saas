import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

export async function GET() {
  try {
    const rows = await db.$queryRaw<
      Array<{
        plan: string;
        name: string;
        price: number;
        priceLabel: string;
        description: string;
        features: string[] | null;
      }>
    >(Prisma.sql`
      SELECT "plan"::text AS "plan", "name", "price", "priceLabel", "description", "features"
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
  } catch {
    return NextResponse.json({ data: [] }, { status: 200 });
  }
}
