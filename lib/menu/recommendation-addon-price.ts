import { formatAddonDelta } from '@/lib/format-money';
import { getMinVariationPrice } from '@/lib/menu-item-pricing';
import type { RestaurantRegionalSettings } from '@/lib/restaurant-regional';
import {
  shouldShowOptionQuantityPrice,
  shouldShowQuantityGroupPickerPrices,
} from '@/lib/menu/recommendation-limits';

/** Product-type recommendations: base item included; only variation uplift may bill. */
export const PRODUCT_RECOMMENDATION_UNIT_PRICE = 0;

export type ProductRecommendationItemLike = {
  price: number;
  salePrice: number | null;
  variations?: Array<{ id: string; priceDelta: number }> | null;
};

/** Cheapest variation (or list price) baseline for a recommended product. */
export function productRecommendationListBaseline(
  item: ProductRecommendationItemLike
): number {
  return variationPickerBaselineUnitPrice(
    effectiveMenuItemUnitPrice(item.price, item.salePrice),
    item.variations
  );
}

/** Cart unit for a recommended product: uplift above cheapest variation only. */
export function productRecommendationVariationUnitPrice(
  item: ProductRecommendationItemLike,
  selectedVariationId: string | null | undefined
): number {
  const variations = item.variations ?? [];
  if (variations.length === 0 || !selectedVariationId) {
    return PRODUCT_RECOMMENDATION_UNIT_PRICE;
  }
  const pv = variations.find((v) => v.id === selectedVariationId);
  if (!pv) return PRODUCT_RECOMMENDATION_UNIT_PRICE;
  return chargeableVariationUnitPrice(
    pv.priceDelta,
    productRecommendationListBaseline(item)
  );
}

/** Guest-facing (+€delta) for a recommended product variation picker. */
export function productRecommendationVariationPriceLabel(
  item: ProductRecommendationItemLike,
  variationUnitPrice: number,
  regional?: Partial<RestaurantRegionalSettings>
): string | null {
  return formatVariationAddonDisplay(
    variationUnitPrice,
    productRecommendationListBaseline(item),
    regional
  );
}

/** Effective sell price for a menu item (sale when valid, else list). */
export function effectiveMenuItemUnitPrice(
  price: number,
  salePrice: number | null | undefined
): number {
  if (salePrice != null && salePrice > 0 && salePrice < price) return salePrice;
  return price;
}

/** Addon delta vs category default; null when at or below default (hide price in UI). */
export function recommendationAddonDelta(
  itemPrice: number,
  itemSalePrice: number | null | undefined,
  defaultUnitPrice: number | null | undefined
): number | null {
  if (defaultUnitPrice == null) return null;
  const unit = effectiveMenuItemUnitPrice(itemPrice, itemSalePrice);
  const delta = Math.round((unit - defaultUnitPrice) * 100) / 100;
  if (delta <= 0) return null;
  return delta;
}

/** Guest-facing label: (+€delta) or full (+€price) when no default baseline. */
export function formatRecommendationAddonDisplay(
  itemPrice: number,
  itemSalePrice: number | null | undefined,
  defaultUnitPrice: number | null | undefined,
  regional?: Partial<RestaurantRegionalSettings>
): string | null {
  const delta = recommendationAddonDelta(
    itemPrice,
    itemSalePrice,
    defaultUnitPrice
  );
  if (defaultUnitPrice != null) {
    if (delta == null) return null;
    return formatAddonDelta(delta, regional);
  }
  const unit = effectiveMenuItemUnitPrice(itemPrice, itemSalePrice);
  return formatAddonDelta(unit, regional);
}

/** Guest-facing addon label for recommendation pickers (quantity + free tier). */
export function recommendationAddonPriceLabel(
  itemPrice: number,
  itemSalePrice: number | null | undefined,
  defaultUnitPrice: number | null | undefined,
  options?: {
    freeQuantity?: number | null;
    multipleMode?: 'CHECKBOX' | 'QUANTITY' | null;
    /** All selected option ids in the group (with duplicates for qty). */
    groupSelectedIds?: string[];
    optionId?: string;
    regional?: Partial<RestaurantRegionalSettings>;
  }
): string | null {
  if (options?.multipleMode === 'QUANTITY') {
    const groupSelectedIds = options.groupSelectedIds ?? [];
    const show =
      options.optionId != null
        ? shouldShowOptionQuantityPrice(
            groupSelectedIds,
            options.optionId,
            options.freeQuantity
          )
        : shouldShowQuantityGroupPickerPrices(
            groupSelectedIds,
            options.freeQuantity
          );
    if (!show) return null;
  }
  return formatRecommendationAddonDisplay(
    itemPrice,
    itemSalePrice,
    defaultUnitPrice,
    options?.regional
  );
}

/** Chargeable unit for cart totals (delta when default baseline is set). */
export function chargeableRecommendationUnitPrice(
  itemPrice: number,
  itemSalePrice: number | null | undefined,
  defaultUnitPrice: number | null | undefined
): number {
  const unit = effectiveMenuItemUnitPrice(itemPrice, itemSalePrice);
  if (defaultUnitPrice == null) return unit;
  return Math.max(0, Math.round((unit - defaultUnitPrice) * 100) / 100);
}

/** Baseline for variation picker labels and uplift (cheapest variation, else list price). */
export function variationPickerBaselineUnitPrice(
  listUnitPrice: number,
  variations: Array<{ priceDelta: number }> | null | undefined
): number {
  return getMinVariationPrice(variations) ?? listUnitPrice;
}

/**
 * Variation addon above parent list price (absolute unit).
 * Null when variation price is at or below that price (included in product).
 */
export function variationAddonDelta(
  variationUnitPrice: number,
  parentListUnitPrice: number | null | undefined
): number | null {
  if (parentListUnitPrice == null) return null;
  const delta =
    Math.round((variationUnitPrice - parentListUnitPrice) * 100) / 100;
  if (delta <= 0) return null;
  return delta;
}

/** UI label for a variation option vs parent list price. */
export function formatVariationAddonDisplay(
  variationUnitPrice: number,
  parentListUnitPrice: number | null | undefined,
  regional?: Partial<RestaurantRegionalSettings>
): string | null {
  const delta = variationAddonDelta(variationUnitPrice, parentListUnitPrice);
  if (parentListUnitPrice != null) {
    if (delta == null) return null;
    return formatAddonDelta(delta, regional);
  }
  return formatAddonDelta(variationUnitPrice, regional);
}

/** Extra charge vs parent list price (0 when variation matches included price). */
export function chargeableVariationUnitPrice(
  variationUnitPrice: number,
  parentListUnitPrice: number | null | undefined
): number {
  if (parentListUnitPrice == null) return variationUnitPrice;
  return Math.max(
    0,
    Math.round((variationUnitPrice - parentListUnitPrice) * 100) / 100
  );
}

/**
 * Cart unit when parent product list price already includes the smallest variation.
 * Only adds uplift when the chosen variation priceDelta is above that list price.
 */
export function productUnitPriceWithVariation(
  productBaseUnitPrice: number,
  selectedVariationPriceDelta: number | null | undefined,
  allVariations?: Array<{ priceDelta: number }> | null
): number {
  const baseline = variationPickerBaselineUnitPrice(
    productBaseUnitPrice,
    allVariations
  );
  if (selectedVariationPriceDelta == null) return baseline;
  return (
    baseline +
    chargeableVariationUnitPrice(selectedVariationPriceDelta, baseline)
  );
}
