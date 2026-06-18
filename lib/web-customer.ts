export const WEB_CUSTOMER_TAKEAWAY_NAME = 'web-customer (take-away)';

export function resolveWebCustomerName(
  orderType: 'delivery' | 'pickUp',
  addressName?: string | null
): string {
  const trimmed = addressName?.trim() ?? '';
  if (orderType === 'pickUp') {
    return trimmed || WEB_CUSTOMER_TAKEAWAY_NAME;
  }
  return trimmed;
}
