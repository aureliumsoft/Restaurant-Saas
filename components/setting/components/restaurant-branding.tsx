'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'react-toastify';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Base64ImageUploadField } from '@/components/ui/base64-image-upload';
import { PremiumDisabledControl } from '@/components/premium/premium-disabled-control';
import { PremiumGate } from '@/components/premium/premium-gate';
import { useEntitlements } from '@/hooks/use-entitlements';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { normalizeThemePrimaryColor } from '@/lib/restaurant-theme';
import eventBus from '@/lib/even';
import { revalidateStaffBootstrap } from '@/hooks/use-staff-bootstrap-swr';

type RestaurantBrandingDto = {
  id: string;
  logoUrl: string | null;
  mainBannerUrl: string | null;
  menuBannerUrls: string[];
  themePrimaryColor?: string | null;
};

type RestaurantBrandingCardProps = {
  /** Starter plan: logo, banners, and theme cannot be changed. */
  brandingAllowed?: boolean;
};

export function RestaurantBrandingCard({
  brandingAllowed = true,
}: RestaurantBrandingCardProps) {
  const { t } = useTranslation();
  const { caps, canCreateMore } = useEntitlements();
  const [loading, setLoading] = useState(true);
  const [hasRestaurant, setHasRestaurant] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');
  const [mainBannerUrl, setMainBannerUrl] = useState('');
  const [menuBanners, setMenuBanners] = useState<string[]>(['']);
  const [themePrimaryColor, setThemePrimaryColor] = useState('#ea580c');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get<{ data: RestaurantBrandingDto | null }>(
          '/api/restaurant'
        );
        const d = res.data?.data;
        if (cancelled) return;
        if (!d) {
          setHasRestaurant(false);
          setLogoUrl('');
          setMainBannerUrl('');
          setMenuBanners(['']);
          return;
        }
        setHasRestaurant(true);
        setLogoUrl(d.logoUrl ?? '');
        setMainBannerUrl(d.mainBannerUrl ?? '');
        const urls = (d.menuBannerUrls ?? []).filter(Boolean);
        setMenuBanners(urls.length > 0 ? urls : ['']);
        setThemePrimaryColor(d.themePrimaryColor ?? '#ea580c');
      } catch {
        if (!cancelled) toast.error(t('settings.cards.branding.loadFailed'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function addMenuBannerRow() {
    setMenuBanners((prev) => [...prev, '']);
  }

  function setMenuBanner(i: number, v: string) {
    setMenuBanners((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
  }

  function removeMenuBanner(i: number) {
    setMenuBanners((prev) => {
      const next = prev.filter((_, idx) => idx !== i);
      return next.length > 0 ? next : [''];
    });
  }

  async function handleSave() {
    if (!brandingAllowed) {
      toast.error(t('settings.cards.branding.planRestricted'));
      return;
    }
    if (!navigator.onLine) {
      toast.error(t('settings.cards.shopName.offline'));
      return;
    }

    const menuBannerUrls = menuBanners.map((s) => s.trim()).filter(Boolean);

    setSaving(true);
    try {
      const normalizedThemePrimaryColor =
        normalizeThemePrimaryColor(themePrimaryColor);
      const res = await axios.patch<{ data: RestaurantBrandingDto }>(
        '/api/restaurant',
        {
          logoUrl,
          mainBannerUrl,
          menuBannerUrls,
          themePrimaryColor: normalizedThemePrimaryColor ?? '',
        }
      );
      const d = res.data?.data;
      if (d) {
        setLogoUrl(d.logoUrl ?? '');
        setMainBannerUrl(d.mainBannerUrl ?? '');
        const urls = (d.menuBannerUrls ?? []).filter(Boolean);
        setMenuBanners(urls.length > 0 ? urls : ['']);
        setThemePrimaryColor(d.themePrimaryColor ?? '#ea580c');
      }
      toast.success(t('settings.cards.branding.saved'));
      eventBus.emit('fetchStoreData');
      eventBus.emit('realtime:config.branding');
      void revalidateStaffBootstrap();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: unknown } } };
      const flat = err.response?.data?.error;
      if (flat && typeof flat === 'object' && 'fieldErrors' in flat) {
        const fe = (flat as { fieldErrors?: Record<string, string[]> })
          .fieldErrors;
        const msg = fe
          ? Object.values(fe).flat().filter(Boolean).join(' ')
          : '';
        toast.error(msg || t('settings.cards.branding.validationFailed'));
      } else {
        toast.error(t('settings.cards.branding.saveFailed'));
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.cards.branding.title')}</CardTitle>
          <CardDescription>
            <Loader2 className="mx-auto animate-spin text-primary" />
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!hasRestaurant) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.cards.branding.title')}</CardTitle>
          <CardDescription>
            {t('settings.cards.branding.noRestaurant')}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.cards.branding.title')}</CardTitle>
        <CardDescription>
          {t('settings.cards.branding.description')}
        </CardDescription>
        {!brandingAllowed ? (
          <p className="text-sm text-muted-foreground">
            {t('settings.cards.branding.planHint')}
          </p>
        ) : null}
      </CardHeader>
      <CardContent
        className={`space-y-4 ${!brandingAllowed ? 'pointer-events-none opacity-60' : ''}`}
      >
        <Base64ImageUploadField
          label={t('settings.cards.branding.logoLabel')}
          value={logoUrl}
          onChange={setLogoUrl}
          helperText={t('settings.cards.branding.logoHelper')}
        />
        <div className="space-y-2">
          <Label htmlFor="restaurant-theme-primary-color">
            {t('settings.cards.branding.themeColorLabel')}
          </Label>
          <div className="flex flex-wrap items-center gap-3">
            <Input
              id="restaurant-theme-primary-color"
              type="color"
              value={themePrimaryColor}
              onChange={(e) => setThemePrimaryColor(e.target.value)}
              className="h-11 w-16 cursor-pointer p-1"
            />
            <Input
              type="text"
              value={themePrimaryColor}
              onChange={(e) => setThemePrimaryColor(e.target.value)}
              placeholder="#ea580c"
              className="w-40"
              autoComplete="off"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {t('settings.cards.branding.themeColorHint')}
          </p>
        </div>
        <PremiumGate locked={!caps?.mainBanner} className="space-y-2">
          <Base64ImageUploadField
            label={t('settings.cards.branding.mainBannerLabel')}
            value={mainBannerUrl}
            onChange={setMainBannerUrl}
            helperText={t('settings.cards.branding.mainBannerHelper')}
          />
        </PremiumGate>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>{t('settings.cards.branding.menuBannersLabel')}</Label>
            <PremiumDisabledControl
              locked={!canCreateMore('menuBanners', menuBanners.length)}
              label={t('settings.cards.branding.addBanner')}
              className="h-9"
            >
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addMenuBannerRow}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t('settings.cards.branding.addBanner')}
              </Button>
            </PremiumDisabledControl>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('settings.cards.branding.menuBannersHint')}
          </p>
          {menuBanners.map((url, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <Base64ImageUploadField
                  label={t('settings.cards.branding.menuBannerItemLabel', {
                    n: i + 1,
                  })}
                  value={url}
                  onChange={(v) => setMenuBanner(i, v)}
                />
              </div>
              {menuBanners.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-destructive hover:bg-destructive/10"
                  onClick={() => removeMenuBanner(i)}
                  aria-label={t(
                    'settings.cards.branding.removeMenuBannerAria',
                    { n: i + 1 }
                  )}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              ) : null}
            </div>
          ))}
        </div>

        <Button
          className="w-full"
          type="button"
          disabled={saving || !brandingAllowed}
          onClick={() => void handleSave()}
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              <span>{t('settings.cards.branding.saving')}</span>
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              <span>{t('settings.cards.branding.saveBranding')}</span>
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
