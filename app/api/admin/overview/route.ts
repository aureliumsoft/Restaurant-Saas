import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { endOfDay, startOfMonth, subMonths, subYears } from "date-fns";

import { requirePlatformAdmin } from "@/lib/auth/adminRequest";
import { db } from "@/lib/db";

function countByStatus(
  groups: Array<{ status: string; _count: number }>
): Record<string, number> {
  return Object.fromEntries(groups.map((g) => [g.status, g._count]));
}

type RangePreset = "monthly" | "3m" | "6m" | "1y" | "custom";

type OverviewBody = {
  data: Record<string, unknown>;
};

const overviewCache = new Map<string, { at: number; body: OverviewBody }>();
const overviewInflight = new Map<string, Promise<OverviewBody>>();
const OVERVIEW_CACHE_MS = 20_000;

function parseRange(req: NextRequest): {
  preset: RangePreset;
  from: Date;
  to: Date;
} {
  const url = new URL(req.url);
  const rawPreset = (url.searchParams.get("preset") ?? "monthly") as RangePreset;
  const preset: RangePreset = ["monthly", "3m", "6m", "1y", "custom"].includes(rawPreset)
    ? rawPreset
    : "monthly";

  const now = new Date();

  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");
  const parsedFrom = fromParam ? new Date(fromParam) : null;
  const parsedTo = toParam ? new Date(toParam) : null;
  const fromValid = parsedFrom && !Number.isNaN(parsedFrom.getTime());
  const toValid = parsedTo && !Number.isNaN(parsedTo.getTime());

  if (preset === "custom" && fromValid && toValid) {
    const from = parsedFrom!;
    const to = endOfDay(parsedTo!);
    return from <= to ? { preset, from, to } : { preset, from: to, to: from };
  }

  if (preset === "3m") {
    return { preset, from: subMonths(now, 3), to: endOfDay(now) };
  }
  if (preset === "6m") {
    return { preset, from: subMonths(now, 6), to: endOfDay(now) };
  }
  if (preset === "1y") {
    return { preset, from: subYears(now, 1), to: endOfDay(now) };
  }

  // monthly (default): current month-to-date
  return { preset: "monthly", from: startOfMonth(now), to: endOfDay(now) };
}

async function loadOverview(req: NextRequest): Promise<OverviewBody> {
  const range = parseRange(req);
  const createdAtFilter = { gte: range.from, lte: range.to };

    const [
      restaurantCount,
      subscriptionGroups,
      demoRequestCount,
      recentRestaurants,
      recentRequests,
    ] = await Promise.all([
      db.restaurant.count({ where: { createdAt: createdAtFilter } }),
      db.restaurantSubscription.groupBy({
        by: ["status"],
        _count: true,
        where: {
          restaurant: {
            createdAt: createdAtFilter,
          },
        },
      }),
      db.demoRequest.count({ where: { createdAt: createdAtFilter } }),
      db.restaurant.findMany({
        where: { createdAt: createdAtFilter },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          name: true,
          subdomain: true,
          createdAt: true,
          owner: { select: { name: true } },
          subscription: { select: { status: true, plan: true } },
        },
      }),
      db.demoRequest.findMany({
        where: { createdAt: createdAtFilter },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          name: true,
          email: true,
          restaurantName: true,
          createdAt: true,
        },
      }),
    ]);

    const byStatus = countByStatus(
      subscriptionGroups.map((g) => ({ status: g.status, _count: g._count }))
    );
    const subscribedTotal = subscriptionGroups.reduce((sum, g) => sum + g._count, 0);

    const subscriptionBreakdown = {
      active: byStatus.ACTIVE ?? 0,
      trial: byStatus.TRIAL ?? 0,
      pastDue: byStatus.PAST_DUE ?? 0,
      canceled: byStatus.CANCELED ?? 0,
      noSubscription: Math.max(0, restaurantCount - subscribedTotal),
    };

    return {
      data: {
        range: {
          preset: range.preset,
          from: range.from.toISOString(),
          to: range.to.toISOString(),
        },
        restaurantCount,
        activeSubscriptions: subscriptionBreakdown.active,
        trialSubscriptions: subscriptionBreakdown.trial,
        demoRequestCount,
        subscriptionBreakdown,
        recentRestaurants: recentRestaurants.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
        })),
        recentRequests: recentRequests.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
        })),
      },
    };
}

export async function GET(req: NextRequest) {
  const auth = await requirePlatformAdmin(req);
  if ("error" in auth) return auth.error;

  try {
    const range = parseRange(req);
    const cacheKey = `${range.preset}:${range.from.toISOString()}:${range.to.toISOString()}`;
    const fresh = new URL(req.url).searchParams.get("fresh") === "1";
    if (!fresh) {
      const hit = overviewCache.get(cacheKey);
      if (hit && Date.now() - hit.at < OVERVIEW_CACHE_MS) {
        return NextResponse.json(hit.body);
      }
      const pending = overviewInflight.get(cacheKey);
      if (pending) {
        return NextResponse.json(await pending);
      }
    }

    const pending = loadOverview(req);
    overviewInflight.set(cacheKey, pending);
    try {
      const body = await pending;
      overviewCache.set(cacheKey, { at: Date.now(), body });
      return NextResponse.json(body);
    } finally {
      overviewInflight.delete(cacheKey);
    }
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load overview" }, { status: 500 });
  }
}
