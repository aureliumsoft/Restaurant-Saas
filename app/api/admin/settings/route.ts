import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requirePlatformAdmin } from "@/lib/auth/adminRequest";
import { db } from "@/lib/db";
import { PLATFORM_SETTING_DEFAULTS } from "@/lib/platform-settings";

const DEFAULTS: Record<string, string> = { ...PLATFORM_SETTING_DEFAULTS };

const putSchema = z.object({
  entries: z.array(
    z.object({
      key: z.string().min(1).max(120),
      value: z.string().max(8000),
    })
  ),
});

export async function GET(req: NextRequest) {
  const auth = await requirePlatformAdmin(req);
  if ("error" in auth) return auth.error;

  try {
    const rows = await db.platformSetting.findMany({ orderBy: { key: "asc" } });
    const map: Record<string, string> = { ...DEFAULTS };
    for (const r of rows) {
      map[r.key] = r.value;
    }
    return NextResponse.json({ data: map });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requirePlatformAdmin(req);
  if ("error" in auth) return auth.error;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = putSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    for (const { key, value } of parsed.data.entries) {
      await db.platformSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
    }
    const rows = await db.platformSetting.findMany({ orderBy: { key: "asc" } });
    const map: Record<string, string> = { ...DEFAULTS };
    for (const r of rows) {
      map[r.key] = r.value;
    }
    return NextResponse.json({ data: map }, { status: 200 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
