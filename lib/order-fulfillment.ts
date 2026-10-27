/** Parse `Name:` / `Phone:` lines from order address snapshot (kiosk / online / POS). */
export function parseCustomerFromAddressSnapshot(
  address: string | null | undefined
): { name: string | null; phone: string | null } {
  if (!address?.trim()) return { name: null, phone: null };
  const nameMatch = address.match(/^Name:\s*(.+)$/im);
  const phoneMatch = address.match(/^Phone:\s*(.+)$/im);
  return {
    name: nameMatch?.[1]?.trim() ?? null,
    phone: phoneMatch?.[1]?.trim() ?? null,
  };
}

/** Parse `Table:` line from order address snapshot (kiosk dine-in / POS). */
export function parseTableFromAddressSnapshot(
  address: string | null | undefined
): string | null {
  if (!address?.trim()) return null;
  const match = address.match(/^Table:\s*(.+)$/im);
  return match?.[1]?.trim() ?? null;
}

/** Parse `Fulfillment:` line from order address snapshot (online / kiosk / POS). */
export function parseFulfillmentFromAddressSnapshot(
  address: string | null | undefined
): string | null {
  if (!address?.trim()) return null;
  const match = address.match(/^Fulfillment:\s*(.+)$/im);
  return match?.[1]?.trim() ?? null;
}

/** Parse cooking / customer note lines from address snapshot (kiosk / online). */
export function parseNoteFromAddressSnapshot(
  address: string | null | undefined
): string | null {
  if (!address?.trim()) return null;
  const cooking = address.match(/^Cooking\s*\/\s*notes:\s*(.+)$/im);
  if (cooking?.[1]?.trim()) return cooking[1].trim();
  const customer = address.match(/^Customer note:\s*(.+)$/im);
  if (customer?.[1]?.trim()) return customer[1].trim();
  return null;
}

/** True when address snapshot records cutlery requested. */
export function parseCutleryFromAddressSnapshot(
  address: string | null | undefined
): boolean {
  if (!address?.trim()) return false;
  return /^Cutlery requested:\s*yes\s*$/im.test(address);
}

/** User-facing method label for sales list and order detail. */
export function salesOrderMethodLabel(opts: {
  address?: string | null;
  sourceType: string;
  tableLabel?: string | null;
}): string | null {
  if (opts.tableLabel?.trim()) {
    return `Table ${opts.tableLabel.trim()}`;
  }

  const raw = parseFulfillmentFromAddressSnapshot(opts.address);
  if (!raw) return null;

  const lower = raw.toLowerCase();
  const source = opts.sourceType.toUpperCase();

  if (source === 'ONLINE') {
    if (lower.includes('delivery')) return 'Delivery';
    if (lower.includes('pick')) return 'Pickup';
  }

  if (source === 'KIOSK') {
    if (lower.includes('dine')) return 'Dine in';
    if (lower.includes('take')) return 'Take away';
  }

  if (source === 'POS' || source === 'OTHER') {
    if (lower.includes('dine') || lower.includes('table')) return raw;
    if (lower.includes('take')) return 'Take away';
    if (lower.includes('delivery')) return 'Delivery';
  }

  return raw;
}
