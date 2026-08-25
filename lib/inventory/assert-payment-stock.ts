import { db } from '@/lib/db';
import {
  assertIngredientsAvailableForOrder,
  isMajorIngredientOutOfStockError,
  type StockOrderLine,
  type StockOrderModifierGroup,
} from '@/lib/inventory/stock';

function parseModifiers(raw: unknown): StockOrderModifierGroup[] {
  if (!Array.isArray(raw)) return [];
  const modifiers: StockOrderModifierGroup[] = [];
  for (const group of raw) {
    if (!group || typeof group !== 'object') continue;
    const selectionsRaw = (group as { selections?: unknown }).selections;
    if (!Array.isArray(selectionsRaw)) continue;
    modifiers.push({
      selections: selectionsRaw.map((sel) => {
        const s =
          sel && typeof sel === 'object' ? (sel as Record<string, unknown>) : {};
        return {
          menuItemId: typeof s.menuItemId === 'string' ? s.menuItemId : null,
          variationId:
            typeof s.variationId === 'string' ? s.variationId : null,
        };
      }),
    });
  }
  return modifiers;
}

export function stockLinesFromUnknownCart(payload: unknown): StockOrderLine[] | null {
  if (!payload || typeof payload !== 'object') return null;
  const obj = payload as Record<string, unknown>;
  const rawLines = Array.isArray(obj.lines)
    ? obj.lines
    : Array.isArray(obj.items)
      ? obj.items
      : null;
  if (!rawLines || rawLines.length === 0) return null;

  const lines: StockOrderLine[] = [];
  for (const raw of rawLines) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    const menuItemId = (
      typeof row.menuItemId === 'string'
        ? row.menuItemId
        : typeof row.productId === 'string'
          ? String(row.productId).split('::sw:')[0] ?? row.productId
          : ''
    ).trim();
    const quantity = Math.floor(Number(row.quantity ?? row.qty));
    if (!menuItemId || !Number.isFinite(quantity) || quantity < 1) continue;
    lines.push({
      menuItemId,
      quantity,
      variationId: typeof row.variationId === 'string' ? row.variationId : null,
      modifiers: parseModifiers(row.modifiers),
    });
  }
  return lines.length > 0 ? lines : null;
}

export async function stockBlockErrorForRestaurant(
  restaurantId: string,
  lines: StockOrderLine[]
): Promise<string | null> {
  try {
    await assertIngredientsAvailableForOrder(db, {
      restaurantId,
      lines,
      requireVariation: true,
    });
    return null;
  } catch (e) {
    if (isMajorIngredientOutOfStockError(e)) return e.message;
    if (e instanceof Error && e.message.includes('Select a variation')) {
      return e.message;
    }
    throw e;
  }
}

/**
 * Before sending the guest to Stripe / PayPal / wallets: fail with the
 * ingredient name if recipe stock cannot cover this cart.
 */
export async function paymentStockBlockError(
  restaurantSlug: string | undefined,
  payload: unknown
): Promise<string | null> {
  const slug = restaurantSlug?.trim();
  if (!slug) return null;
  const lines = stockLinesFromUnknownCart(payload);
  if (!lines) return null;

  const restaurant = await db.restaurant.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!restaurant) return 'Restaurant not found';

  return stockBlockErrorForRestaurant(restaurant.id, lines);
}
