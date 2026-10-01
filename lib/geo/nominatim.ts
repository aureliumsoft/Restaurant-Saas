export type MapCoords = {
  lat: number;
  lon: number;
};

const NOMINATIM_HEADERS: HeadersInit = {
  Accept: 'application/json',
};

function asFiniteNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? n : null;
}

/** Reverse-geocode a map point to a display address (OpenStreetMap Nominatim). */
export async function reverseGeocodeAddress(
  coords: MapCoords,
  signal?: AbortSignal
): Promise<string | null> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('format', 'json');
  url.searchParams.set('lat', String(coords.lat));
  url.searchParams.set('lon', String(coords.lon));
  url.searchParams.set('zoom', '18');
  url.searchParams.set('addressdetails', '0');

  const res = await fetch(url.toString(), {
    headers: NOMINATIM_HEADERS,
    signal,
  });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as {
    display_name?: string;
  } | null;
  return typeof data?.display_name === 'string' && data.display_name.trim()
    ? data.display_name.trim()
    : null;
}

/** Forward-geocode an address string to coordinates. */
export async function geocodeAddress(
  query: string,
  options?: { countryCode?: string; signal?: AbortSignal }
): Promise<(MapCoords & { label: string }) | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  url.searchParams.set('q', trimmed);
  if (options?.countryCode?.trim()) {
    url.searchParams.set('countrycodes', options.countryCode.trim().toLowerCase());
  }

  const res = await fetch(url.toString(), {
    headers: NOMINATIM_HEADERS,
    signal: options?.signal,
  });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => [])) as Array<{
    lat?: string;
    lon?: string;
    display_name?: string;
  }>;
  const hit = data[0];
  const lat = asFiniteNumber(hit?.lat);
  const lon = asFiniteNumber(hit?.lon);
  if (lat == null || lon == null) return null;
  return {
    lat,
    lon,
    label:
      typeof hit?.display_name === 'string' && hit.display_name.trim()
        ? hit.display_name.trim()
        : trimmed,
  };
}

export function defaultMapCenter(countryCode?: string | null): MapCoords {
  switch ((countryCode ?? '').toUpperCase()) {
    case 'PK':
      return { lat: 24.8607, lon: 67.0011 };
    case 'ES':
    default:
      return { lat: 40.4168, lon: -3.7038 };
  }
}

export function formatCoordsFallback(coords: MapCoords): string {
  return `${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}`;
}
