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
  defaultUnitPrice: number | null | undefined
): string | null {
  const delta = recommendationAddonDelta(
    itemPrice,
    itemSalePrice,
    defaultUnitPrice
  );
  if (defaultUnitPrice != null) {
    if (delta == null) return null;
    return `(+€${delta.toFixed(2)})`;
  }
  const unit = effectiveMenuItemUnitPrice(itemPrice, itemSalePrice);
  return `(+€${unit.toFixed(2)})`;
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
  parentListUnitPrice: number | null | undefined
): string | null {
  const delta = variationAddonDelta(variationUnitPrice, parentListUnitPrice);
  if (parentListUnitPrice != null) {
    if (delta == null) return null;
    return `(+€${delta.toFixed(2)})`;
  }
  return `(+€${variationUnitPrice.toFixed(2)})`;
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
  selectedVariationPriceDelta: number | null | undefined
): number {
  if (selectedVariationPriceDelta == null) return productBaseUnitPrice;
  return (
    productBaseUnitPrice +
    chargeableVariationUnitPrice(
      selectedVariationPriceDelta,
      productBaseUnitPrice
    )
  );
}
