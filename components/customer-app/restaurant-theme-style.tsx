import { buildRestaurantThemeOverrideCss } from '@/lib/restaurant-theme';

export function RestaurantThemeStyle({
  color,
  styleId = 'restaurant-theme-ssr',
}: {
  color?: string | null;
  styleId?: string;
}) {
  const css = buildRestaurantThemeOverrideCss(color);
  if (!css) return null;
  return (
    <style id={styleId} dangerouslySetInnerHTML={{ __html: css }} />
  );
}
