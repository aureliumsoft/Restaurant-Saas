import type { UiLanguage } from '@/lib/i18n/resources';
import { resources } from '@/lib/i18n/resources';

export const BILINGUAL_SEPARATOR = '&&&&';

export type BilingualText = { en: string; es: string };

const EMPTY: BilingualText = { en: '', es: '' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** True when a string looks like our persisted `{ "en", "es" }` payload. */
export function looksLikeBilingualJson(raw: string): boolean {
  const t = raw.trim();
  if (!t.startsWith('{') || !t.endsWith('}')) return false;
  return /"en"\s*:/.test(t) || /"es"\s*:/.test(t);
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

/**
 * If en/es values were accidentally saved as nested bilingual JSON strings,
 * unwrap them so the UI never shows `{"en":...}`.
 */
function unwrapNestedBilingualParts(
  parts: BilingualText,
  depth = 0
): BilingualText {
  if (depth > 4) return parts;
  let { en, es } = parts;

  const enIsJson = en ? looksLikeBilingualJson(en) : false;
  const esIsJson = es ? looksLikeBilingualJson(es) : false;

  if (enIsJson) {
    const inner = parseStoredBilingualText(en);
    // Outer was a mistaken wrap of a full bilingual payload
    if (!es || esIsJson || es === en) {
      return unwrapNestedBilingualParts(inner, depth + 1);
    }
    en = inner.en || inner.es || en;
  }

  if (esIsJson) {
    const inner = parseStoredBilingualText(es);
    if (!en) {
      return unwrapNestedBilingualParts(inner, depth + 1);
    }
    es = inner.es || inner.en || es;
  }

  return { en, es };
}

/** Split editor input: "English &&&& Spanish". */
export function parseBilingualInput(input: string): BilingualText {
  const raw = input ?? '';
  const idx = raw.indexOf(BILINGUAL_SEPARATOR);
  if (idx < 0) {
    const only = raw.trim();
    // Form accidentally holds stored JSON — treat as stored payload, not plain EN.
    if (looksLikeBilingualJson(only)) {
      return parseStoredBilingualText(only);
    }
    return { en: only, es: '' };
  }
  return {
    en: raw.slice(0, idx).trim(),
    es: raw.slice(idx + BILINGUAL_SEPARATOR.length).trim(),
  };
}

/** Build editor value from parts. */
export function bilingualInputFromParts(parts: BilingualText): string {
  const unwrapped = unwrapNestedBilingualParts(parts);
  const en = unwrapped.en?.trim() ?? '';
  const es = unwrapped.es?.trim() ?? '';
  if (!en && !es) return '';
  if (!es) return en;
  if (!en) return `${BILINGUAL_SEPARATOR} ${es}`.trim();
  // Same text in both locales → show once (single-language content).
  if (en === es) return en;
  return `${en} ${BILINGUAL_SEPARATOR} ${es}`;
}

/** Persist as stringified `{ en, es }`. */
export function serializeBilingualText(parts: BilingualText): string {
  const unwrapped = unwrapNestedBilingualParts(parts);
  return JSON.stringify({
    en: unwrapped.en?.trim() ?? '',
    es: unwrapped.es?.trim() ?? '',
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
    if (fromObj) return unwrapNestedBilingualParts(fromObj);
    return { ...EMPTY };
  }

  if (
    typeof raw !== 'string' &&
    typeof raw !== 'number' &&
    typeof raw !== 'boolean'
  ) {
    return { ...EMPTY };
  }

  const trimmed = String(raw).trim();
  if (!trimmed) return { ...EMPTY };

  if (trimmed.startsWith('{') || trimmed.startsWith('"')) {
    try {
      let parsed: unknown = JSON.parse(trimmed);
      // Double-encoded string payload
      if (typeof parsed === 'string') {
        return parseStoredBilingualText(parsed);
      }
      if (isRecord(parsed)) {
        const fromJson = partsFromRecord(parsed);
        if (fromJson) return unwrapNestedBilingualParts(fromJson);
      }
    } catch {
      // fall through — try regex salvage for near-JSON blobs
      const salvaged = salvageBilingualJson(trimmed);
      if (salvaged) return unwrapNestedBilingualParts(salvaged);
    }
  }

  // Legacy: either plain text or still using &&&& in DB
  if (trimmed.includes(BILINGUAL_SEPARATOR)) {
    return unwrapNestedBilingualParts(parseBilingualInput(trimmed));
  }

  // Plain single-language string — available for both UI languages.
  return { en: trimmed, es: trimmed };
}

/** Best-effort extract en/es when JSON.parse fails (e.g. bad quotes inside). */
function salvageBilingualJson(raw: string): BilingualText | null {
  if (!looksLikeBilingualJson(raw)) return null;
  const enMatch = raw.match(/"en"\s*:\s*"((?:\\.|[^"\\])*)"/);
  const esMatch = raw.match(/"es"\s*:\s*"((?:\\.|[^"\\])*)"/);
  if (!enMatch && !esMatch) return null;
  const unescape = (s: string) => {
    try {
      return JSON.parse(`"${s}"`) as string;
    } catch {
      return s.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
    }
  };
  return {
    en: enMatch ? unescape(enMatch[1]).trim() : '',
    es: esMatch ? unescape(esMatch[1]).trim() : '',
  };
}

/**
 * Pick locale for display; fall back to the other locale.
 * Never returns a raw `{"en":...}` blob — unwraps nested bilingual JSON.
 */
export function resolveBilingualText(
  raw: unknown,
  lang: UiLanguage
): string {
  const parts = parseStoredBilingualText(raw);
  let primary = (lang === 'en' ? parts.en : parts.es).trim();
  if (!primary) {
    primary = (lang === 'en' ? parts.es : parts.en).trim();
  }
  // Defensive: if something still looks like stored JSON, unwrap once more.
  if (primary && looksLikeBilingualJson(primary)) {
    return resolveBilingualText(primary, lang);
  }
  return primary;
}

/** Serialize editor input to DB string (empty → ""). */
export function serializeBilingualInput(input: string): string {
  const trimmed = (input ?? '').trim();
  if (!trimmed) return '';
  // Already a stored bilingual payload — normalize, do not nest again.
  if (looksLikeBilingualJson(trimmed)) {
    const parts = parseStoredBilingualText(trimmed);
    if (parts.en || parts.es) return serializeBilingualText(parts);
  }
  const parts = parseBilingualInput(trimmed);
  if (!parts.en && !parts.es) return '';
  return serializeBilingualText(parts);
}

/** Form hydrate: DB → `en &&&& es` editor string. */
export function bilingualInputFromStored(raw: unknown): string {
  return bilingualInputFromParts(parseStoredBilingualText(raw));
}

function resourceTemplate(
  lang: UiLanguage,
  key: string,
  vars?: Record<string, string>
): string {
  const translation = resources[lang]?.translation as unknown as
    | Record<string, unknown>
    | undefined;
  const raw = translation?.[key];
  let template = typeof raw === 'string' ? raw : key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      template = template.replaceAll(`{{${k}}}`, v);
    }
  }
  return template;
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
      en: enName
        ? resourceTemplate('en', 'customizeChooseAddonsNamed', { name: enName })
        : resourceTemplate('en', 'customizeChooseAddons'),
      es: esName
        ? resourceTemplate('es', 'customizeChooseAddonsNamed', { name: esName })
        : resourceTemplate('es', 'customizeChooseAddons'),
    });
  }
  if (mode === 'chooseFrom') {
    return serializeBilingualText({
      en: enName
        ? resourceTemplate('en', 'customizeChooseFrom', { name: enName })
        : resourceTemplate('en', 'customizeChooseFromOptions'),
      es: esName
        ? resourceTemplate('es', 'customizeChooseFrom', { name: esName })
        : resourceTemplate('es', 'customizeChooseFromOptions'),
    });
  }
  return serializeBilingualText({
    en: enName
      ? resourceTemplate('en', 'customizeChoose', { name: enName })
      : resourceTemplate('en', 'recommended'),
    es: esName
      ? resourceTemplate('es', 'customizeChoose', { name: esName })
      : resourceTemplate('es', 'recommended'),
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
    en: enList
      ? resourceTemplate('en', 'customizeChooseAddonsNamed', { name: enList })
      : resourceTemplate('en', 'customizeChooseAddons'),
    es: esList
      ? resourceTemplate('es', 'customizeChooseAddonsNamed', { name: esList })
      : resourceTemplate('es', 'customizeChooseAddons'),
  });
}
