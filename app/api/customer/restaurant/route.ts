import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  RESTAURANT_SERVICE_CHARGE_DB_SELECT,
  withServiceChargesPayload,
} from "@/lib/restaurant-service-charge";

function getSubdomainFromHost(hostname: string) {
  if (hostname.endsWith(".localhost")) {
    const sub = hostname.replace(".localhost", "");
    if (sub && sub !== "www") return sub;
    return null;
  }
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (rootDomain && hostname.endsWith(`.${rootDomain}`)) {
    const sub = hostname.slice(0, -(`.${rootDomain}`.length));
    if (sub && sub !== "www") return sub;
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const slug = req.nextUrl.searchParams.get("slug")?.trim();
    const fromQuery = req.nextUrl.searchParams.get("subdomain");
    const host = (req.headers.get("host") || "").split(":")[0];
    const fromHost = getSubdomainFromHost(host);

    const select = {
      id: true,
      name: true,
      logoUrl: true,
      mainBannerUrl: true,
      menuBannerUrls: true,
      themePrimaryColor: true,
      subdomain: true,
      slug: true,
      ...RESTAURANT_SERVICE_CHARGE_DB_SELECT,
    } as const;

    if (slug) {
      const restaurant = await db.restaurant.findUnique({
        where: { slug },
        select,
      });
      return NextResponse.json(
        { data: restaurant ? withServiceChargesPayload(restaurant) : null },
        { status: 200 }
      );
    }

    const subdomain = fromQuery || fromHost;
    if (!subdomain) {
      return NextResponse.json(
        { error: "Missing subdomain or slug." },
        { status: 400 }
      );
    }

    const restaurant = await db.restaurant.findUnique({
      where: { subdomain },
      select,
    });

    return NextResponse.json(
      {
        data: restaurant ? withServiceChargesPayload(restaurant) : null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching customer restaurant:", error);
    return NextResponse.json(
      { error: "Failed to fetch restaurant data." },
      { status: 500 }
    );
  }
}
