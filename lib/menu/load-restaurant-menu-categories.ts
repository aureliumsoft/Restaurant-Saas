import type { Prisma } from '@prisma/client';

import { loadCategoriesWithLinkedItems } from '@/lib/menu/menu-item-categories';

export async function loadRestaurantMenuCategories<
  TCategorySelect extends Prisma.MenuCategorySelect & { id: true },
  TItemSelect extends Prisma.MenuItemSelect,
>(options: {
  restaurantId: string;
  categorySelect: TCategorySelect;
  itemSelect: TItemSelect;
  categoryWhere?: Prisma.MenuCategoryWhereInput;
}) {
  return loadCategoriesWithLinkedItems({
    restaurantId: options.restaurantId,
    categorySelect: options.categorySelect,
    itemSelect: options.itemSelect,
    categoryWhere: options.categoryWhere,
  });
}
