'use client';

import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  ChefHat,
  Globe,
  Home,
  Monitor,
  ShieldAlert,
  Tv,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export type DisabledFeatureType =
  | 'website'
  | 'kiosk'
  | 'kds'
  | 'order-display';

const FEATURE_CONFIG: Record<
  DisabledFeatureType,
  {
    title: string;
    subtitle: string;
    description: string;
    icon: typeof Globe;
    accentColor: string;
  }
> = {
  website: {
    title: 'Website & Online Ordering Disabled',
    subtitle: 'Storefront Currently Inactive',
    description:
      'Online ordering and the customer website are currently disabled for this restaurant. Please contact the restaurant directly or check back later.',
    icon: Globe,
    accentColor: 'from-amber-500/20 to-orange-500/10 text-amber-500 border-amber-500/30',
  },
  kiosk: {
    title: 'Kiosk Ordering Disabled',
    subtitle: 'Self-Service Terminal Inactive',
    description:
      'Self-service kiosk ordering is currently disabled for this restaurant branch. Please place your order at the main counter.',
    icon: Monitor,
    accentColor: 'from-blue-500/20 to-cyan-500/10 text-blue-500 border-blue-500/30',
  },
  kds: {
    title: 'Kitchen Display System (KDS) Disabled',
    subtitle: 'Kitchen Screen Module Inactive',
    description:
      'The Kitchen Display System module is currently turned off in Restaurant Settings. Orders are being processed directly via POS.',
    icon: ChefHat,
    accentColor: 'from-rose-500/20 to-fire-500/10 text-fire-500 border-fire-500/30',
  },
  'order-display': {
    title: 'Order Display Screen Disabled',
    subtitle: 'Public Screen Inactive',
    description:
      'The Customer Order Display screen is currently turned off in Restaurant Settings. Please enable Order Display in Settings to view live orders.',
    icon: Tv,
    accentColor: 'from-purple-500/20 to-indigo-500/10 text-purple-500 border-purple-500/30',
  },
};

export function FeatureDisabledScreen({
  feature,
  restaurantName,
  homeUrl = '/',
  customMessage,
}: {
  feature: DisabledFeatureType;
  restaurantName?: string;
  homeUrl?: string;
  customMessage?: string;
}) {
  const cfg = FEATURE_CONFIG[feature] ?? FEATURE_CONFIG.website;
  const Icon = cfg.icon;

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-background p-4 sm:p-6">
      {/* Background ambient decorative glows */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-gradient-to-br from-fire-500/10 via-amber-500/5 to-transparent blur-3xl dark:from-fire-500/20"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-40 right-1/4 h-[400px] w-[400px] rounded-full bg-gradient-to-tr from-primary/10 to-transparent blur-3xl dark:from-primary/15"
        aria-hidden
      />

      <div className="relative z-10 mx-auto w-full max-w-lg">
        <div className="overflow-hidden rounded-3xl border border-border/80 bg-card/90 p-6 shadow-2xl backdrop-blur-xl sm:p-8 dark:bg-card/75 dark:border-white/10 dark:shadow-black/60">
          <div className="flex flex-col items-center text-center">
            {/* Pulsing Icon Badge */}
            <div className="relative mb-5 flex h-20 w-20 items-center justify-center">
              <div className="absolute inset-0 animate-ping rounded-3xl bg-destructive/10 opacity-70" />
              <div
                className={`relative flex h-20 w-20 items-center justify-center rounded-3xl border bg-gradient-to-br shadow-inner ${cfg.accentColor}`}
              >
                <Icon className="h-10 w-10" />
              </div>
            </div>

            {/* Status Pill */}
            <div className="inline-flex items-center gap-1.5 rounded-full border border-destructive/20 bg-destructive/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Service Unavailable</span>
            </div>

            {/* Restaurant Title */}
            {restaurantName ? (
              <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {restaurantName}
              </p>
            ) : null}

            {/* Headline */}
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {cfg.title}
            </h1>

            {/* Description */}
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
              {customMessage || cfg.description}
            </p>

            {/* Action Buttons */}
            <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
              <Button
                asChild
                variant="default"
                className="rounded-2xl bg-fire-500 font-semibold shadow-lg shadow-fire-500/25 hover:bg-fire-600"
              >
                <Link href={homeUrl}>
                  <Home className="mr-2 h-4 w-4" />
                  Return to Home
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.history.back();
                  }
                }}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go Back
              </Button>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          If you are the restaurant owner or manager, you can re-enable this
          channel under{' '}
          <Link
            href="/settings"
            className="font-medium text-fire-500 underline underline-offset-4 hover:text-fire-600"
          >
            Restaurant Settings &rarr; Order Channels
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
