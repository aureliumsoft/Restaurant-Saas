import type { Prisma } from '@prisma/client';

/** Synthetic phone prefix for dine-in kiosk customers (one row per table). */
export const KIOSK_DINE_PHONE_PREFIX = 'kiosk-dine:';

/** Display + speech name for dine-in, e.g. "Table 1 Customer". */
export function kioskDineInCustomerDisplayName(tableName: string): string {
  const t = tableName.trim();
  if (!t) return 'Table Customer';
  const label = /^table\b/i.test(t) ? t : `Table ${t}`;
  return `${label} Customer`;
}

export function kioskDineInCustomerPhone(tableId: string): string {
  return `${KIOSK_DINE_PHONE_PREFIX}${tableId}`.slice(0, 40);
}

export function isKioskSyntheticCustomerPhone(
  phone: string | null | undefined
): boolean {
  return !!phone?.trim().startsWith(KIOSK_DINE_PHONE_PREFIX);
}

type DbTx = Prisma.TransactionClient;

/**
 * Create or update a `Customer` for kiosk checkout.
 * - Take away: real name + phone (upsert by phone).
 * - Dine in: "{Table N} Customer" with a stable synthetic phone per table.
 */
export async function upsertKioskOrderCustomer(
  tx: DbTx,
  restaurantId: string,
  opts: {
    fulfillment: 'dine_in' | 'take_away';
    tableId?: string;
    tableName?: string;
    customerName?: string;
    customerPhone?: string;
  }
): Promise<string | null> {
  if (opts.fulfillment === 'dine_in') {
    const tableId = opts.tableId?.trim();
    const tableName = opts.tableName?.trim();
    if (!tableId || !tableName) return null;

    const name = kioskDineInCustomerDisplayName(tableName);
    const phone = kioskDineInCustomerPhone(tableId);

    const existing = await tx.customer.findFirst({
      where: { restaurantId, phone },
      select: { id: true },
    });
    if (existing) {
      await tx.customer.update({
        where: { id: existing.id },
        data: { name },
      });
      return existing.id;
    }

    const created = await tx.customer.create({
      data: { restaurantId, name, phone },
    });
    return created.id;
  }

  const phone = opts.customerPhone?.trim();
  const name = opts.customerName?.trim() || 'Guest';

  if (!phone) {
    if (!opts.customerName?.trim()) return null;
    const created = await tx.customer.create({
      data: { restaurantId, name, phone: 'N/A' },
    });
    return created.id;
  }
  const existing = await tx.customer.findFirst({
    where: { restaurantId, phone },
    select: { id: true, name: true },
  });
  if (existing) {
    if (name !== existing.name) {
      await tx.customer.update({
        where: { id: existing.id },
        data: { name },
      });
    }
    return existing.id;
  }

  const created = await tx.customer.create({
    data: { restaurantId, name, phone },
  });
  return created.id;
}
