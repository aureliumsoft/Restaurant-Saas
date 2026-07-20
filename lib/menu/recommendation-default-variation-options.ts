import type { RestaurantVariationRow } from '@/components/dashboard/menu-manager/types';

export type DefaultVariationOption = {
  restaurantVariationId: string;
  label: string;
};

/** All restaurant variation templates for category recommendation defaults. */
export function buildRestaurantDefaultVariationOptions(
  templates: RestaurantVariationRow[]
): DefaultVariationOption[] {
  return templates.map((template) => ({
    restaurantVariationId: template.id,
    label: template.shortLabel?.trim() || template.name,
  }));
}
