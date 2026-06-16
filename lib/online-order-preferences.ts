export function cutleryStorageKey(orderId: string): string {
  return `cutlery-${orderId}`;
}

export function commentStorageKey(orderId: string): string {
  return `comment-${orderId}`;
}

export function readCutleryPreference(orderId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(cutleryStorageKey(orderId)) === 'true';
  } catch {
    return false;
  }
}

export function writeCutleryPreference(orderId: string, value: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (value) {
      localStorage.setItem(cutleryStorageKey(orderId), 'true');
    } else {
      localStorage.removeItem(cutleryStorageKey(orderId));
    }
  } catch {
    // ignore quota / private mode
  }
}

export function readOrderCommentPreference(orderId: string): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(commentStorageKey(orderId)) ?? '';
  } catch {
    return '';
  }
}

export function writeOrderCommentPreference(orderId: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = value.trim();
    if (trimmed) {
      localStorage.setItem(commentStorageKey(orderId), trimmed);
    } else {
      localStorage.removeItem(commentStorageKey(orderId));
    }
  } catch {
    // ignore
  }
}

export function clearOnlineOrderPreferences(orderId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(cutleryStorageKey(orderId));
    localStorage.removeItem(commentStorageKey(orderId));
  } catch {
    // ignore
  }
}
