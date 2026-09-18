import {
  buildRestaurantThemeOverrideCss,
  buildStorefrontThemeVars,
  normalizeThemePrimaryColor,
} from '@/lib/restaurant-theme';

export const RESTAURANT_THEME_COOKIE = 'foodluk-rt';
export const LAST_CUSTOMER_RESTAURANT_SLUG_KEY = 'lastCustomerRestaurantSlug';
const THEME_PRIMARY_STORAGE_PREFIX = 'foodluk-theme-primary:';

export function themePrimaryStorageKey(slug: string): string {
  return `${THEME_PRIMARY_STORAGE_PREFIX}${slug.trim().toLowerCase()}`;
}

export function parseRestaurantThemeCookie(
  raw?: string | null
): { slug: string; color: string } | null {
  if (!raw) return null;
  try {
    const decoded = decodeURIComponent(raw);
    const sep = decoded.lastIndexOf('|');
    if (sep <= 0) return null;
    const slug = decoded.slice(0, sep).trim();
    const color = normalizeThemePrimaryColor(decoded.slice(sep + 1));
    if (!slug || !color) return null;
    return { slug, color };
  } catch {
    return null;
  }
}

export function serializeRestaurantThemeCookie(
  slug: string,
  color: string
): string {
  return encodeURIComponent(`${slug.trim()}|${color}`);
}

export function readCachedRestaurantThemePrimary(
  slug?: string | null
): string | null {
  if (typeof window === 'undefined') return null;
  const resolved =
    slug?.trim() ||
    (() => {
      try {
        return localStorage.getItem(LAST_CUSTOMER_RESTAURANT_SLUG_KEY)?.trim() || '';
      } catch {
        return '';
      }
    })();
  if (!resolved) {
    return parseRestaurantThemeCookie(readRawThemeCookie())?.color ?? null;
  }
  try {
    const stored = localStorage.getItem(themePrimaryStorageKey(resolved));
    const fromStorage = normalizeThemePrimaryColor(stored);
    if (fromStorage) return fromStorage;
  } catch {
    /* ignore */
  }
  const fromCookie = parseRestaurantThemeCookie(readRawThemeCookie());
  if (fromCookie && fromCookie.slug.toLowerCase() === resolved.toLowerCase()) {
    return fromCookie.color;
  }
  return fromCookie?.color ?? null;
}

export function applyRestaurantThemeToDom(color?: string | null): void {
  if (typeof document === 'undefined') return;
  const css = buildRestaurantThemeOverrideCss(color);
  if (!css) return;

  let styleEl = document.getElementById(
    'restaurant-theme-override'
  ) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'restaurant-theme-override';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = css;

  const host = document.querySelector('.web-app-customer') as HTMLElement | null;
  if (!host) return;
  const vars = buildStorefrontThemeVars(color);
  for (const [key, value] of Object.entries(vars)) {
    if (key.startsWith('--')) host.style.setProperty(key, value);
  }
}

export function writeCachedRestaurantThemePrimary(
  slug?: string | null,
  color?: string | null
): void {
  const normalizedSlug = slug?.trim() || null;
  const normalizedColor = normalizeThemePrimaryColor(color);
  if (typeof window === 'undefined') return;

  try {
    if (normalizedSlug) {
      localStorage.setItem(LAST_CUSTOMER_RESTAURANT_SLUG_KEY, normalizedSlug);
      if (normalizedColor) {
        localStorage.setItem(
          themePrimaryStorageKey(normalizedSlug),
          normalizedColor
        );
      }
    }
  } catch {
    /* ignore quota / private mode */
  }

  if (normalizedSlug && normalizedColor) {
    try {
      document.cookie = `${RESTAURANT_THEME_COOKIE}=${serializeRestaurantThemeCookie(
        normalizedSlug,
        normalizedColor
      )}; Path=/; Max-Age=2592000; SameSite=Lax`;
    } catch {
      /* ignore */
    }
  }

  applyRestaurantThemeToDom(normalizedColor);
}

function readRawThemeCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${RESTAURANT_THEME_COOKIE}=([^;]*)`)
  );
  return match?.[1] ? match[1] : null;
}

/** Runs before paint so cached restaurant colors skip the default orange flash. */
export const RESTAURANT_THEME_BOOT_SCRIPT = `(function(){try{var reserved={admin:1,analytics:1,api:1,blog:1,branched:1,dashboard:1,kds:1,kiosk:1,login:1,order:1,orders:1,payment:1,pos:1,pricing:1,register:1,settings:1};var slug=null;var q=new URLSearchParams(location.search);slug=q.get("restaurantSlug")||q.get("slug");if(!slug){var seg=location.pathname.split("/").filter(Boolean)[0];if(seg){seg=decodeURIComponent(seg);if(!reserved[seg])slug=seg}}if(!slug){try{slug=localStorage.getItem("${LAST_CUSTOMER_RESTAURANT_SLUG_KEY}")}catch(e){}}if(!slug){var cm=document.cookie.match(/(?:^|; )${RESTAURANT_THEME_COOKIE}=([^;]*)/);if(cm){try{slug=decodeURIComponent(cm[1]).split("|")[0]}catch(e){}}}if(!slug)return;var color=null;try{color=localStorage.getItem("${THEME_PRIMARY_STORAGE_PREFIX}"+slug.toLowerCase())}catch(e){}if(!color||color.charAt(0)!=="#"){var c2=document.cookie.match(/(?:^|; )${RESTAURANT_THEME_COOKIE}=([^;]*)/);if(c2){try{var parts=decodeURIComponent(c2[1]).split("|");if(parts[1]&&parts[1].charAt(0)==="#")color=parts[1]}catch(e){}}}if(!color||!/^#[0-9a-fA-F]{6}$/.test(color))return;var r=parseInt(color.slice(1,3),16)/255,g=parseInt(color.slice(3,5),16)/255,b=parseInt(color.slice(5,7),16)/255;function lin(v){return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)}var L=0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b);var fg=L>0.5?"#0f172a":"#ffffff";var css=".web-app-customer,.dark .web-app-customer,html.dark .web-app-customer{--primary:"+color+";--ring:"+color+";--sidebar-primary:"+color+";--restaurant-primary:"+color+";--primary-foreground:"+fg+";--sidebar-primary-foreground:"+fg+"}";var s=document.getElementById("restaurant-theme-boot");if(!s){s=document.createElement("style");s.id="restaurant-theme-boot";document.documentElement.appendChild(s)}s.textContent=css;}catch(e){}})();`;
