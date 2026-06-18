import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  RESTAURANT_BRANDING_DB_SELECT,
  RESTAURANT_SERVICE_CHARGE_DB_SELECT,
  isPrismaUnknownFieldError,
  withDefaultServiceChargesPayload,
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

async function findCustomerRestaurant(
  where: { slug: string } | { subdomain: string }
) {
  const selectWithCharges = {
    ...RESTAURANT_BRANDING_DB_SELECT,
    ...RESTAURANT_SERVICE_CHARGE_DB_SELECT,
  } as const;

  try {
    const restaurant = await db.restaurant.findUnique({
      where,
      select: selectWithCharges,
    });
    if (!restaurant) return null;
    return withServiceChargesPayload(restaurant);
  } catch (error) {
    if (!isPrismaUnknownFieldError(error)) throw error;
    const restaurant = await db.restaurant.findUnique({
      where,
      select: RESTAURANT_BRANDING_DB_SELECT,
    });
    if (!restaurant) return null;
    return withDefaultServiceChargesPayload(restaurant);
  }
}

export async function GET(req: NextRequest) {
  try {
    const slug = req.nextUrl.searchParams.get("slug")?.trim();
    const fromQuery = req.nextUrl.searchParams.get("subdomain");
    const host = (req.headers.get("host") || "").split(":")[0];
    const fromHost = getSubdomainFromHost(host);

    if (slug) {
      const data = await findCustomerRestaurant({ slug });
      return NextResponse.json({ data }, { status: 200 });
    }

    const subdomain = fromQuery || fromHost;
    if (!subdomain) {
      return NextResponse.json(
        { error: "Missing subdomain or slug." },
        { status: 400 }
      );
    }

    const data = await findCustomerRestaurant({ subdomain });
    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    console.error("Error fetching customer restaurant:", error);
    return NextResponse.json(
      { error: "Failed to fetch restaurant data." },
      { status: 500 }
    );
  }
}
