import type { Prisma } from '@prisma/client';

/**
 * MenuItemVariation rows usable on POS / kiosk / web:
 * custom (no template) or linked to an active restaurant variation template.
 */
export const MENU_ITEM_VARIATION_SELLABLE_WHERE: Prisma.MenuItemVariationWhereInput =
  {
    OR: [
      { restaurantVariationId: null },
      { restaurantVariation: { isActive: true } },
    ],
  };
