import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { db } from "@/lib/db";

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  restaurant: z.string().trim().min(2).max(200),
  phone: z.string().trim().max(40).optional(),
});

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const restaurantLabel = parsed.data.phone
      ? `${parsed.data.restaurant} · Tel: ${parsed.data.phone}`
      : parsed.data.restaurant;

    const row = await db.$queryRaw<{ id: string }[]>(
      Prisma.sql`
        INSERT INTO "DemoRequest" ("id","name","email","restaurantName","createdAt","updatedAt")
        VALUES (
          ${`dr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`},
          ${parsed.data.name},
          ${parsed.data.email.toLowerCase()},
          ${restaurantLabel},
          now(),
          now()
        )
        RETURNING "id"
      `
    );

    return NextResponse.json({ data: row[0] ?? null }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to submit demo request" }, { status: 500 });
  }
}
