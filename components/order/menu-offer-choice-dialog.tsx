'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, CupSoda, ShoppingBag } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { buildThemeCssVars } from '@/lib/restaurant-theme';
import {
  formatMenuItemPrice,
  type MenuItemPriceSource,
} from '@/lib/menu-item-pricing';
import type { BundleLookupProduct } from '@/lib/menu/find-bundle-parent-products';

type OfferProduct = BundleLookupProduct & Pick<MenuItemPriceSource, 'variations'>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: OfferProduct | null;
  bundleProducts: OfferProduct[];
  themePrimaryColor?: string | null;
  onChooseSingle: () => void;
  onChooseBundle: (bundle: OfferProduct) => void;
};

function ComboIcon() {
  return (
    <div className="flex h-[4.5rem] w-[4.5rem] items-center justify-center gap-1 rounded-xl bg-primary text-primary-foreground shadow-sm">
      <CupSoda className="h-7 w-7 shrink-0" strokeWidth={1.75} aria-hidden />
      <ShoppingBag className="h-8 w-8 shrink-0" strokeWidth={1.75} aria-hidden />
    </div>
  );
}

function SingleIcon() {
  return (
    <div className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
      <ShoppingBag className="h-10 w-10" strokeWidth={1.75} aria-hidden />
    </div>
  );
}

export function MenuOfferChoiceDialog({
  open,
  onOpenChange,
  product,
  bundleProducts,
  themePrimaryColor,
  onChooseSingle,
  onChooseBundle,
}: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState<'offer' | 'bundles'>('offer');

  useEffect(() => {
    if (!open) setStep('offer');
  }, [open]);

  const themeStyle = useMemo(() => {
    const primaryVars = buildThemeCssVars(themePrimaryColor);
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
      '--border': 'oklch(0.9022 0.0052 247.8822)',
      '--input': 'oklch(0.97 0.0029 264.542)',
      colorScheme: 'light',
    } as CSSProperties;
  }, [themePrimaryColor]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl gap-0 overflow-hidden border border-border bg-background p-0 text-foreground sm:rounded-2xl"
        style={themeStyle}
      >
        <DialogTitle className="sr-only">
          {step === 'offer' ? t('menuOfferTitle') : t('menuOfferChooseMenu')}
        </DialogTitle>

        <header className="bg-primary px-4 py-4 text-center text-primary-foreground sm:px-6 sm:py-5">
          {step === 'bundles' ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 text-primary-foreground hover:bg-white/15 hover:text-primary-foreground"
                onClick={() => setStep('offer')}
                aria-label={t('menuOfferBack')}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <h2 className="flex-1 text-base font-bold uppercase tracking-wide sm:text-lg">
                {t('menuOfferChooseMenu')}
              </h2>
              <span className="w-9 shrink-0" aria-hidden />
            </div>
          ) : (
            <h2 className="text-base font-bold uppercase tracking-wide sm:text-lg">
              {t('menuOfferTitle')}
            </h2>
          )}
        </header>

        {step === 'offer' ? (
          <div className="space-y-6 bg-background px-4 py-6 sm:px-8 sm:py-8">
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
              <button
                type="button"
                className="flex min-h-[11rem] flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-card px-4 py-6 text-center shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/30"
                onClick={() => setStep('bundles')}
              >
                <ComboIcon />
                <div className="space-y-1">
                  <p className="text-sm font-bold uppercase leading-snug text-primary sm:text-base">
                    {t('menuOfferYesTitle')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('menuOfferYesSubtitle')}
                  </p>
                </div>
              </button>

              <button
                type="button"
                className="flex min-h-[11rem] flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-card px-4 py-6 text-center shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/30"
                onClick={onChooseSingle}
              >
                <SingleIcon />
                <div className="space-y-1">
                  <p className="text-sm font-bold uppercase leading-snug text-primary sm:text-base">
                    {t('menuOfferNoTitle')}
                  </p>
                  {product ? (
                    <p className="text-sm text-muted-foreground">
                      {formatMenuItemPrice(product)}
                    </p>
                  ) : null}
                </div>
              </button>
            </div>

            <div className="flex justify-center">
              <Button
                type="button"
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => onOpenChange(false)}
              >
                {t('cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 bg-background px-4 py-6 sm:px-8 sm:py-8">
            <p className="text-center text-sm text-muted-foreground">
              {t('menuOfferChooseMenuSubtitle')}
            </p>
            <div className="grid max-h-[min(50vh,22rem)] gap-3 overflow-y-auto sm:grid-cols-2">
              {bundleProducts.map((bundle) => (
                <button
                  key={bundle.id}
                  type="button"
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/30"
                  onClick={() => onChooseBundle(bundle)}
                >
                  {bundle.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- menu image URLs
                    <img
                      src={bundle.imageUrl}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <ShoppingBag className="h-7 w-7" aria-hidden />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-bold uppercase leading-snug text-foreground">
                      {bundle.name}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatMenuItemPrice(bundle)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => onOpenChange(false)}
              >
                {t('cancel')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
