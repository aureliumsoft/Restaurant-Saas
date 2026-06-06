/** Base path for a branch-specific kiosk install. */
export function kioskBasePath(slug: string, branchId: string) {
  return `/kiosk/${encodeURIComponent(slug)}/${encodeURIComponent(branchId)}`;
}

export function kioskSuccessPath(slug: string, branchId: string) {
  return `${kioskBasePath(slug, branchId)}/success`;
}

export function kioskCartStorageKey(slug: string, branchId: string) {
  return `kiosk-cart-${slug}-${branchId}`;
}

export function kioskCheckoutDraftKey(slug: string, branchId: string) {
  return `kiosk-checkout-draft-${slug}-${branchId}`;
}
