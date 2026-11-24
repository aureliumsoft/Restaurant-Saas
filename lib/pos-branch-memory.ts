const POS_BRANCH_KEY = 'foodluk-pos-active-branch';

/** Last POS branch, so the menu can start before staff bootstrap returns. */
export function readCachedPosBranchId(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const id = sessionStorage.getItem(POS_BRANCH_KEY)?.trim();
    return id || null;
  } catch {
    return null;
  }
}

export function writeCachedPosBranchId(branchId: string | null | undefined) {
  if (typeof sessionStorage === 'undefined') return;
  const id = branchId?.trim();
  if (!id) return;
  try {
    sessionStorage.setItem(POS_BRANCH_KEY, id);
  } catch {
    // The live bootstrap id is still used once it arrives.
  }
}
