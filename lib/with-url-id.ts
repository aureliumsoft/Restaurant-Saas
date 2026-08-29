import { encodeUrlId } from '@/lib/url-id';

export type WithUrlId<T> = T & { urlId: string };

/** Attach a stable encrypted `urlId` for client URLs. */
export function withUrlId<T extends { id: string }>(row: T): WithUrlId<T> {
  return { ...row, urlId: encodeUrlId(row.id) };
}

export function withUrlIds<T extends { id: string }>(rows: T[]): WithUrlId<T>[] {
  return rows.map(withUrlId);
}
