type ThemeCssVars = Record<string, string>;

const HEX_COLOR_RE = /^#([0-9a-fA-F]{6})$/;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace('#', '');
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const rr = clamp(Math.round(r), 0, 255).toString(16).padStart(2, '0');
  const gg = clamp(Math.round(g), 0, 255).toString(16).padStart(2, '0');
  const bb = clamp(Math.round(b), 0, 255).toString(16).padStart(2, '0');
  return `#${rr}${gg}${bb}`;
}

function darken(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

function lighten(hex: string, amount: number): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(
    r + (255 - r) * amount,
    g + (255 - g) * amount,
    b + (255 - b) * amount
  );
}

function mix(hexA: string, hexB: string, weightA: number): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const w = clamp(weightA, 0, 1);
  return rgbToHex(
    a.r * w + b.r * (1 - w),
    a.g * w + b.g * (1 - w),
    a.b * w + b.b * (1 - w)
  );
}

export function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`;
}

function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const channels = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

export function normalizeThemePrimaryColor(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!HEX_COLOR_RE.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

export function getThemePrimaryForeground(primaryHex: string): string {
  return luminance(primaryHex) > 0.5 ? '#0f172a' : '#ffffff';
}

export function buildThemeCssVars(primaryRaw?: string | null): ThemeCssVars {
  const primary = normalizeThemePrimaryColor(primaryRaw);
  if (!primary) return {};
  const primaryDark = darken(primary, 0.18);
  return {
    '--primary': primary,
    '--ring': primary,
    '--sidebar-primary': primary,
    '--restaurant-primary': primary,
    '--restaurant-primary-dark': primaryDark,
    '--primary-foreground': getThemePrimaryForeground(primary),
    '--sidebar-primary-foreground': getThemePrimaryForeground(primary),
  };
}

/** Extra CSS variables for generative storefront backgrounds (mesh, glass, surfaces). */
export function buildStorefrontThemeVars(primaryRaw?: string | null): ThemeCssVars {
  const base = buildThemeCssVars(primaryRaw);
  const primary = normalizeThemePrimaryColor(primaryRaw);
  if (!primary) return base;

  const glow = lighten(primary, 0.52);
  const accent = lighten(primary, 0.22);
  const deep = darken(primary, 0.32);
  const surface = mix(primary, '#ffffff', 0.94);
  const foreground = getThemePrimaryForeground(primary);

  return {
    ...base,
    '--restaurant-glow': glow,
    '--restaurant-accent': accent,
    '--restaurant-deep': deep,
    '--restaurant-surface': surface,
    '--restaurant-glass': hexToRgba('#ffffff', 0.78),
    '--restaurant-glass-border': hexToRgba(primary, 0.14),
    '--restaurant-overlay-from': hexToRgba(deep, 0.55),
    '--restaurant-overlay-mid': hexToRgba(primary, 0.28),
    '--restaurant-overlay-to': hexToRgba('#0f172a', 0.35),
    '--restaurant-hero-fg': foreground === '#ffffff' ? '#ffffff' : '#0f172a',
    '--restaurant-hero-muted': foreground === '#ffffff' ? 'rgba(255,255,255,0.82)' : '#64748b',
  };
}

/**
 * Light surface tokens for portaled customer UI (Sheet/Dialog). Keeps storefront,
 * order, and kiosk overlays readable when the app root is in dark mode.
 */
export function buildCustomerLightSurfaceVars(
  primaryRaw?: string | null
): ThemeCssVars {
  const primaryVars = buildThemeCssVars(primaryRaw);
  return {
    ...primaryVars,
    '--background': 'oklch(0.9383 0.0042 236.4993)',
    '--foreground': 'oklch(0.3211 0 0)',
    '--card': 'oklch(1 0 0)',
    '--card-foreground': 'oklch(0.3211 0 0)',
    '--popover': 'oklch(1 0 0)',
    '--popover-foreground': 'oklch(0.3211 0 0)',
    '--secondary': 'oklch(0.967 0.0029 264.5419)',
    '--secondary-foreground': 'oklch(0.4461 0.0263 256.8018)',
    '--muted': 'oklch(0.9846 0.0017 247.8389)',
    '--muted-foreground': 'oklch(0.551 0.0234 264.3637)',
    '--accent': 'oklch(0.9119 0.0222 243.8174)',
    '--accent-foreground': 'oklch(0.3791 0.1378 265.5222)',
    '--border': 'oklch(0.9022 0.0052 247.8822)',
    '--input': 'oklch(0.97 0.0029 264.542)',
    colorScheme: 'light',
  };
}
