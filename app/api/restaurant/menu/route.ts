import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getRestaurantForOwnerRequest } from "@/lib/restaurant/ownerRestaurant";

const menuInclude = {
  menus: {
    orderBy: { name: "asc" as const },
    include: {
      items: {
        orderBy: { updatedAt: "desc" as const },
        include: {
          variations: {
            orderBy: { sortOrder: "asc" as const },
            select: {
              id: true,
              name: true,
              title: true,
              imageUrl: true,
              swatchHex: true,
              priceDelta: true,
              sortOrder: true,
              restaurantVariationId: true,
              restaurantVariation: {
                select: { id: true, name: true, shortLabel: true },
              },
            },
          },
          attributeGroups: {
            orderBy: { sortOrder: "asc" as const },
            select: {
              id: true,
              name: true,
              selectionType: true,
              sourceType: true,
              multipleMode: true,
              freeQuantity: true,
              required: true,
              minItems: true,
              maxItems: true,
              sortOrder: true,
              defaultLinkedMenuItemId: true,
              useVariationPricing: true,
              defaultLinkedMenuItem: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                  salePrice: true,
                },
              },
              linkedCategory: { select: { id: true, name: true } },
              linkedProduct: {
                select: {
                  id: true,
                  name: true,
                  imageUrl: true,
                  price: true,
                  salePrice: true,
                  categoryId: true,
                  category: {
                    select: {
                      id: true,
                      name: true,
                      items: {
                        orderBy: { name: "asc" as const },
                        select: {
                          id: true,
                          name: true,
                          imageUrl: true,
                          price: true,
                          salePrice: true,
                        },
                      },
                    },
                  },
                },
              },
              variationLimits: {
                select: {
                  variationId: true,
                  minItems: true,
                  maxItems: true,
                },
              },
              productCategoryIds: true,
            },
          },
          offersFromThis: {
            orderBy: { sortOrder: "asc" as const },
            include: {
              offeredItem: {
                select: {
                  id: true,
                  name: true,
                  description: true,
                  imageUrl: true,
                  price: true,
                  salePrice: true,
                },
              },
            },
          },
        },
      },
    },
  },
};

export async function GET(req: NextRequest) {
  const auth = await getRestaurantForOwnerRequest(req, {
    moduleKeys: ["product", "pos"],
    action: "access",
  });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const full = await db.restaurant.findUnique({
      where: { id: auth.restaurant.id },
      include: menuInclude,
    });

    return NextResponse.json({ data: full }, { status: 200 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load menu" }, { status: 500 });
  }
}
