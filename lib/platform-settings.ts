import { db } from '@/lib/db';

/** Default PlatformSetting values (DB rows override these). */
export const PLATFORM_SETTING_DEFAULTS = {
  default_trial_days: '14',
  support_email: '',
  billing_notice: '',
  seo_google_site_verification: '',
  seo_gtm_container_id: '',
  seo_ga4_measurement_id: '',
  seo_ga4_property_id: '',
  seo_gsc_property_url: '',
  /** Full service account JSON for GSC + GA4 reporting (preferred). */
  seo_google_reporting_service_account_json: '',
  /** OAuth client (reporting) — used with refresh token when SA JSON is empty. */
  seo_google_client_id: '',
  seo_google_client_secret: '',
  seo_google_reporting_refresh_token: '',
} as const;

export type PlatformSettingKey = keyof typeof PLATFORM_SETTING_DEFAULTS;

/** Public marketing / tracking tags (safe to show on SEO page with property IDs). */
export const SEO_TRACKING_SETTING_KEYS = [
  'seo_google_site_verification',
  'seo_gtm_container_id',
  'seo_ga4_measurement_id',
] as const satisfies readonly PlatformSettingKey[];

/** Dashboard metric property identifiers. */
export const SEO_PROPERTY_SETTING_KEYS = [
  'seo_ga4_property_id',
  'seo_gsc_property_url',
] as const satisfies readonly PlatformSettingKey[];

/** Server-only Google reporting credentials (platform admin SEO page). */
export const SEO_CREDENTIAL_SETTING_KEYS = [
  'seo_google_reporting_service_account_json',
  'seo_google_client_id',
  'seo_google_client_secret',
  'seo_google_reporting_refresh_token',
] as const satisfies readonly PlatformSettingKey[];

export const SEO_SETTING_KEYS = [
  ...SEO_TRACKING_SETTING_KEYS,
  ...SEO_PROPERTY_SETTING_KEYS,
  ...SEO_CREDENTIAL_SETTING_KEYS,
] as const satisfies readonly PlatformSettingKey[];

export async function getPlatformSetting(
  key: PlatformSettingKey | string
): Promise<string> {
  try {
    const row = await db.platformSetting.findUnique({ where: { key } });
    if (row?.value != null) return row.value;
  } catch (e) {
    console.error('getPlatformSetting', key, e);
  }
  return (
    PLATFORM_SETTING_DEFAULTS[key as PlatformSettingKey] ?? ''
  );
}

export async function getPlatformSettingsMap(
  keys?: readonly string[]
): Promise<Record<string, string>> {
  const map: Record<string, string> = { ...PLATFORM_SETTING_DEFAULTS };
  try {
    const rows = await db.platformSetting.findMany({
      where: keys?.length ? { key: { in: [...keys] } } : undefined,
      orderBy: { key: 'asc' },
    });
    for (const r of rows) {
      map[r.key] = r.value;
    }
  } catch (e) {
    console.error('getPlatformSettingsMap', e);
  }
  return map;
}

/** Normalize GA4 Measurement IDs like `G-XXXXXXXX`. Empty string if invalid. */
export function normalizeGa4MeasurementId(raw: string): string {
  const id = raw.trim().toUpperCase();
  if (!/^G-[A-Z0-9]+$/.test(id)) return '';
  return id;
}

/** Normalize GA4 property id (digits only, e.g. `123456789`). */
export function normalizeGa4PropertyId(raw: string): string {
  const id = raw.trim().replace(/\D/g, '');
  if (id.length < 5) return '';
  return id;
}

/** Normalize GTM container IDs like `GTM-XXXXXXX`. Empty string if invalid. */
export function normalizeGtmContainerId(raw: string): string {
  const id = raw.trim().toUpperCase();
  if (!/^GTM-[A-Z0-9]+$/.test(id)) return '';
  return id;
}
