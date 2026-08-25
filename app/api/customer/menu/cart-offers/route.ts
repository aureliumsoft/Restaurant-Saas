import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { resolveCustomerMenuQuery } from '@/lib/menu/resolve-customer-menu-query';

const MENU_CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120',
};

async function resolveRestaurantId(
  slug?: string,
  subdomain?: string
): Promise<string | null> {
  const s = slug?.trim();
  if (s) {
    const row = await db.restaurant.findUnique({
      where: { slug: s },
      select: { id: true },
    });
    return row?.id ?? null;
  }
  const sub = subdomain?.trim();
  if (sub) {
    const row = await db.restaurant.findFirst({
      where: { subdomain: sub },
      select: { id: true },
    });
    return row?.id ?? null;
  }
  return null;
}

/**
 * Lightweight cart helpers: product images + offers for cart line item IDs only.
 * Replaces fetching the full customer menu on the cart page.
 */
export async function GET(req: NextRequest) {
  try {
    const resolved = resolveCustomerMenuQuery(req);
    if ('error' in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: 400 });
    }

    const rawIds = req.nextUrl.searchParams.get('itemIds')?.trim() ?? '';
    const itemIds = [
      ...new Set(
        rawIds
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
          .slice(0, 40)
      ),
    ];

    if (itemIds.length === 0) {
      return NextResponse.json(
        { data: { images: {}, offers: [] } },
        { status: 200, headers: MENU_CACHE_HEADERS }
      );
    }

    const restaurantId = await resolveRestaurantId(
      resolved.slug,
      resolved.subdomain
    );
    if (!restaurantId) {
      return NextResponse.json({ error: 'Restaurant not found.' }, { status: 404 });
    }

    const items = await db.menuItem.findMany({
      where: {
        restaurantId,
        id: { in: itemIds },
      },
      select: {
        id: true,
        offersFromThis: {
          orderBy: { sortOrder: 'asc' },
          take: 12,
          select: {
            offeredItem: {
              select: {
                id: true,
                name: true,
                description: true,
                price: true,
                salePrice: true,
              },
            },
          },
        },
        attributeGroups: {
          where: { required: false },
          orderBy: { sortOrder: 'asc' },
          take: 8,
          select: {
            sourceType: true,
            linkedProduct: {
              select: {
                id: true,
                name: true,
                description: true,
                price: true,
                salePrice: true,
              },
            },
            linkedCategory: {
              select: {
                itemLinks: {
                  orderBy: { sortOrder: 'asc' },
                  take: 12,
                  select: {
                    menuItem: {
                      select: {
                        id: true,
                        name: true,
                        description: true,
                        price: true,
                        salePrice: true,
                      },
                    },
                  },
                },
                items: {
                  orderBy: { name: 'asc' },
                  take: 12,
                  select: {
                    id: true,
                    name: true,
                    description: true,
                    price: true,
                    salePrice: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    type OfferRow = {
      id: string;
      name: string;
      description: string | null;
      imageUrl: string | null;
      price: number;
      salePrice: number | null;
    };

    const offerById = new Map<string, OfferRow>();
    const cartIdSet = new Set(itemIds);

    const addOffer = (
      row:
        | {
            id: string;
            name: string;
            description: string | null;
            price: number;
            salePrice: number | null;
          }
        | null
        | undefined
    ) => {
      if (!row?.id || cartIdSet.has(row.id) || offerById.has(row.id)) return;
      offerById.set(row.id, {
        id: row.id,
        name: row.name,
        description: row.description,
        imageUrl: null,
        price: row.price,
        salePrice: row.salePrice,
      });
    };

    for (const item of items) {
      for (const offer of item.offersFromThis) {
        addOffer(offer.offeredItem);
      }
      for (const group of item.attributeGroups) {
        addOffer(group.linkedProduct);
        for (const linked of group.linkedCategory?.itemLinks ?? []) {
          addOffer(linked.menuItem);
        }
        for (const extra of group.linkedCategory?.items ?? []) {
          addOffer(extra);
        }
      }
    }

    return NextResponse.json(
      {
        data: {
          images: {},
          offers: Array.from(offerById.values()),
        },
      },
      { status: 200, headers: MENU_CACHE_HEADERS }
    );
  } catch (error) {
    console.error('customer menu cart-offers', error);
    return NextResponse.json(
      { error: 'Failed to load cart offers.' },
      { status: 500 }
    );
  }
}
