/** Prefix for encrypted ids in URLs (not a raw UUID/cuid). */
export const URL_ID_PREFIX = 'e1_';

export function isEncodedUrlId(value: string | null | undefined): boolean {
  return Boolean(value?.trim().startsWith(URL_ID_PREFIX));
}
