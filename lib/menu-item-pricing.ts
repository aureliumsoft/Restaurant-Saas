export type MenuItemVariationPrice = {
  priceDelta: number;
};

export type MenuItemPriceSource = {
  price: number;
  salePrice?: number | null;
  variations?: MenuItemVariationPrice[] | null;
};

export function effectiveUnitPrice(price: number, salePrice: number | null | undefined) {
  if (salePrice != null && salePrice > 0 && salePrice < price) return salePrice;
  return price;
}

export function getVariationPrices(
  variations: MenuItemVariationPrice[] | null | undefined
): number[] {
  return (variations ?? [])
    .map((v) => v.priceDelta)
    .filter((p) => Number.isFinite(p) && p > 0);
}

export function hasMenuItemVariations(
  item: MenuItemPriceSource | null | undefined
): boolean {
  return getVariationPrices(item?.variations).length > 0;
}

export function getMinVariationPrice(
  variations: MenuItemVariationPrice[] | null | undefined
): number | null {
  const prices = getVariationPrices(variations);
  if (prices.length === 0) return null;
  return Math.min(...prices);
}

export type MenuItemDisplayPrice = {
  amount: number;
  /** True when amount is the min variation price (show localized “From”). */
  hasFromPrefix: boolean;
  hasVariations: boolean;
  /** strikethrough list price when on sale (non-variable products) */
  compareAt: number | null;
};

export function getMenuItemDisplayPrice(
  item: MenuItemPriceSource
): MenuItemDisplayPrice {
  const minVariation = getMinVariationPrice(item.variations);
  if (minVariation != null) {
    return {
      amount: minVariation,
      hasFromPrefix: true,
      hasVariations: true,
      compareAt: null,
    };
  }
  const compareAt =
    item.salePrice != null &&
    item.salePrice > 0 &&
    item.salePrice < item.price
      ? item.price
      : null;
  return {
    amount: effectiveUnitPrice(item.price, item.salePrice ?? null),
    hasFromPrefix: false,
    hasVariations: false,
    compareAt,
  };
}

export function formatMenuItemPrice(
  item: MenuItemPriceSource,
  options?: { currency?: string; fromLabel?: string }
): string {
  const currency = options?.currency ?? '€';
  const fromLabel = options?.fromLabel ?? 'From';
  const { amount, hasFromPrefix, compareAt } = getMenuItemDisplayPrice(item);
  const main = `${hasFromPrefix ? `${fromLabel} ` : ''}${currency}${amount.toFixed(2)}`;
  if (compareAt != null) {
    return `${currency}${compareAt.toFixed(2)} → ${main}`;
  }
  return main;
}
