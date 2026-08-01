import { db } from '@/lib/db';

/** Default PlatformSetting values (DB rows override these). */
export const PLATFORM_SETTING_DEFAULTS = {
  default_trial_days: '14',
  support_email: '',
  billing_notice: '',
  seo_google_site_verification: '',
  seo_gtm_container_id: '',
  seo_ga4_measurement_id: '',
  seo_gsc_property_url: '',
} as const;

export type PlatformSettingKey = keyof typeof PLATFORM_SETTING_DEFAULTS;

export const SEO_SETTING_KEYS = [
  'seo_google_site_verification',
  'seo_gtm_container_id',
  'seo_ga4_measurement_id',
  'seo_gsc_property_url',
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

/** Normalize GA4 IDs like `G-XXXXXXXX`. Empty string if invalid. */
export function normalizeGa4MeasurementId(raw: string): string {
  const id = raw.trim().toUpperCase();
  if (!/^G-[A-Z0-9]+$/.test(id)) return '';
  return id;
}

/** Normalize GTM container IDs like `GTM-XXXXXXX`. Empty string if invalid. */
export function normalizeGtmContainerId(raw: string): string {
  const id = raw.trim().toUpperCase();
  if (!/^GTM-[A-Z0-9]+$/.test(id)) return '';
  return id;
}
