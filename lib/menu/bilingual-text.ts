import type { UiLanguage } from '@/lib/i18n/resources';

export const BILINGUAL_SEPARATOR = '&&&&';

export type BilingualText = { en: string; es: string };

const EMPTY: BilingualText = { en: '', es: '' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function partsFromRecord(parsed: Record<string, unknown>): BilingualText | null {
  const en =
    typeof parsed.en === 'string'
      ? parsed.en.trim()
      : typeof parsed.EN === 'string'
        ? parsed.EN.trim()
        : '';
  const es =
    typeof parsed.es === 'string'
      ? parsed.es.trim()
      : typeof parsed.ES === 'string'
        ? parsed.ES.trim()
        : '';
  if (en || es || 'en' in parsed || 'es' in parsed) {
    return { en, es };
  }
  return null;
}

/** Split editor input: "English &&&& Spanish". */
export function parseBilingualInput(input: string): BilingualText {
  const raw = input ?? '';
  const idx = raw.indexOf(BILINGUAL_SEPARATOR);
  if (idx < 0) {
    const only = raw.trim();
    return { en: only, es: '' };
  }
  return {
    en: raw.slice(0, idx).trim(),
    es: raw.slice(idx + BILINGUAL_SEPARATOR.length).trim(),
  };
}

/** Build editor value from parts. */
export function bilingualInputFromParts(parts: BilingualText): string {
  const en = parts.en?.trim() ?? '';
  const es = parts.es?.trim() ?? '';
  if (!en && !es) return '';
  if (!es) return en;
  if (!en) return `${BILINGUAL_SEPARATOR} ${es}`.trim();
  return `${en} ${BILINGUAL_SEPARATOR} ${es}`;
}

/** Persist as stringified `{ en, es }`. */
export function serializeBilingualText(parts: BilingualText): string {
  return JSON.stringify({
    en: parts.en?.trim() ?? '',
    es: parts.es?.trim() ?? '',
  });
}

/**
 * Read DB / API value: JSON `{en,es}` string, already-parsed `{en,es}` object,
 * or legacy plain / `&&&&` string.
 */
export function parseStoredBilingualText(raw: unknown): BilingualText {
  if (raw == null) return { ...EMPTY };

  if (isRecord(raw)) {
    const fromObj = partsFromRecord(raw);
    if (fromObj) return fromObj;
    return { ...EMPTY };
  }

  if (typeof raw !== 'string' && typeof raw !== 'number' && typeof raw !== 'boolean') {
    return { ...EMPTY };
  }

  const trimmed = String(raw).trim();
  if (!trimmed) return { ...EMPTY };

  if (trimmed.startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (isRecord(parsed)) {
        const fromJson = partsFromRecord(parsed);
        if (fromJson) return fromJson;
      }
    } catch {
      // fall through to legacy
    }
  }

  // Legacy: either plain text or still using &&&& in DB
  if (trimmed.includes(BILINGUAL_SEPARATOR)) {
    return parseBilingualInput(trimmed);
  }
  return { en: trimmed, es: trimmed };
}

/** Pick locale for display; fall back to the other locale, then empty. */
export function resolveBilingualText(
  raw: unknown,
  lang: UiLanguage
): string {
  const parts = parseStoredBilingualText(raw);
  const primary = lang === 'en' ? parts.en : parts.es;
  if (primary) return primary;
  return lang === 'en' ? parts.es : parts.en;
}

/** Serialize editor input to DB string (empty → ""). */
export function serializeBilingualInput(input: string): string {
  const parts = parseBilingualInput(input);
  if (!parts.en && !parts.es) return '';
  return serializeBilingualText(parts);
}

/** Form hydrate: DB → `en &&&& es` editor string. */
export function bilingualInputFromStored(raw: unknown): string {
  return bilingualInputFromParts(parseStoredBilingualText(raw));
}

/**
 * Build a bilingual "Choose …" style title from a stored bilingual subject
 * (category/product name). Persists as JSON `{en,es}`.
 */
export function serializeBilingualChooseTitle(
  subjectRaw: string | null | undefined,
  mode: 'choose' | 'chooseFrom' | 'addons' = 'choose'
): string {
  const subject = parseStoredBilingualText(subjectRaw);
  const enName = subject.en || subject.es;
  const esName = subject.es || subject.en;
  if (mode === 'addons') {
    return serializeBilingualText({
      en: enName ? `Choose add-ons (${enName})` : 'Choose add-ons',
      es: esName ? `Choose add-ons (${esName})` : 'Choose add-ons',
    });
  }
  if (mode === 'chooseFrom') {
    return serializeBilingualText({
      en: enName ? `Choose from ${enName}` : 'Choose from options',
      es: esName ? `Choose from ${esName}` : 'Choose from options',
    });
  }
  return serializeBilingualText({
    en: enName ? `Choose ${enName}` : 'Recommended',
    es: esName ? `Choose ${esName}` : 'Recommended',
  });
}

/** Join several bilingual subjects for add-on titles. */
export function serializeBilingualChooseAddonsTitle(
  subjectRaws: Array<string | null | undefined>
): string {
  const enParts: string[] = [];
  const esParts: string[] = [];
  for (const raw of subjectRaws) {
    const p = parseStoredBilingualText(raw);
    const en = p.en || p.es;
    const es = p.es || p.en;
    if (en) enParts.push(en);
    if (es) esParts.push(es);
  }
  const enList = enParts.join(', ');
  const esList = esParts.join(', ') || enList;
  return serializeBilingualText({
    en: enList ? `Choose add-ons (${enList})` : 'Choose add-ons',
    es: esList ? `Choose add-ons (${esList})` : 'Choose add-ons',
  });
}
