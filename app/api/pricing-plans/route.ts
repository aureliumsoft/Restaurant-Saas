import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { db } from '@/lib/db';
import { finalPrice } from '@/lib/subscription-catalog-pricing';

type CatalogRow = {
  plan: string;
  name: string;
  price: number;
  priceLabel: string;
  description: string;
  features: string[] | null;
  monthlyDiscountEnabled: boolean;
  monthlyDiscountPercent: number;
  yearlyPrice: number;
  yearlyDiscountEnabled: boolean;
  yearlyDiscountPercent: number;
};

export async function GET() {
  try {
    const rows = await db.$queryRaw<CatalogRow[]>(Prisma.sql`
      SELECT
        "plan"::text AS "plan",
        "name",
        "price",
        "priceLabel",
        "description",
        "features",
        COALESCE("monthlyDiscountEnabled", false) AS "monthlyDiscountEnabled",
        COALESCE("monthlyDiscountPercent", 0) AS "monthlyDiscountPercent",
        COALESCE("yearlyPrice", 0) AS "yearlyPrice",
        COALESCE("yearlyDiscountEnabled", false) AS "yearlyDiscountEnabled",
        COALESCE("yearlyDiscountPercent", 0) AS "yearlyDiscountPercent"
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

    const data = rows.map((row) => ({
      ...row,
      monthlyFinal: finalPrice(
        row.price,
        row.monthlyDiscountEnabled,
        row.monthlyDiscountPercent
      ),
      yearlyFinal: finalPrice(
        row.yearlyPrice,
        row.yearlyDiscountEnabled,
        row.yearlyDiscountPercent
      ),
    }));

    return NextResponse.json({ data }, { status: 200 });
  } catch {
    return NextResponse.json({ data: [] }, { status: 200 });
  }
}
