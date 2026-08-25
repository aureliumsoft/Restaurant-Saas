import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { upsertNewsletterSubscriber } from "@/lib/newsletter/subscribe";

const subscribeSchema = z.object({
  email: z.string().trim().email().max(200),
  name: z.string().trim().max(120).optional().nullable(),
  source: z.string().trim().max(60).optional().nullable(),
});

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = subscribeSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 }
    );
  }

  const result = await upsertNewsletterSubscriber({
    email: parsed.data.email,
    name: parsed.data.name,
    source: parsed.data.source ?? "footer",
  });

  if (!result) {
    return NextResponse.json(
      { error: "Could not subscribe right now. Please try again." },
      { status: 500 }
    );
  }

  if (result.alreadySubscribed) {
    return NextResponse.json(
      { data: { id: result.id }, alreadySubscribed: true },
      { status: 200 }
    );
  }

  if (result.reactivated) {
    return NextResponse.json(
      { data: { id: result.id }, reactivated: true },
      { status: 200 }
    );
  }

  return NextResponse.json({ data: { id: result.id } }, { status: 201 });
}
