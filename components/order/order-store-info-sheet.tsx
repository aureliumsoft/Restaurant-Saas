'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, MapPin, X } from 'lucide-react';

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';
import { buildCustomerLightSurfaceVars } from '@/lib/restaurant-theme';
import type { BranchOpeningHours } from '@/lib/order-time-slots';

const ORDER_ACCENT_GOLD = '#f5d76e';

type OrderStoreInfoSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationTitle: string;
  address: string;
  branchHours?: BranchOpeningHours | null;
};

type MapCoords = {
  lat: number;
  lon: number;
};

function normalizeDayTime(value: string | undefined | null): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  const trimmed = value.trim();
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
    const [hours, minutes] = trimmed.split(':').map(Number);
    if (Number.isFinite(hours) && Number.isFinite(minutes)) {
      return `${String(Math.min(23, Math.max(0, hours))).padStart(2, '0')}:${String(Math.min(59, Math.max(0, minutes))).padStart(2, '0')}`;
    }
  }
  return '';
}

function buildOsmEmbedUrl(coords: MapCoords) {
  const { lat, lon } = coords;
  const delta = 0.012;
  const bbox = [lon - delta, lat - delta, lon + delta, lat + delta].join(',');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(
    bbox
  )}&layer=mapnik&marker=${lat}%2C${lon}`;
}

export function OrderStoreInfoSheet({
  open,
  onOpenChange,
  locationTitle,
  address,
  branchHours,
}: OrderStoreInfoSheetProps) {
  const { i18n, t } = useTranslation();
  const [coords, setCoords] = useState<MapCoords | null>(null);
  const [mapLoading, setMapLoading] = useState(false);

  const trimmedAddress = address.trim();
  const trimmedTitle = locationTitle.trim();

  useEffect(() => {
    if (!open || !trimmedAddress) {
      setCoords(null);
      return;
    }

    let cancelled = false;
    setMapLoading(true);

    void (async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
            trimmedAddress
          )}`,
          { headers: { Accept: 'application/json' } }
        );
        const data = (await res.json().catch(() => [])) as Array<{
          lat?: string;
          lon?: string;
        }>;
        if (cancelled) return;
        const hit = data[0];
        if (hit?.lat && hit?.lon) {
          setCoords({
            lat: Number.parseFloat(hit.lat),
            lon: Number.parseFloat(hit.lon),
          });
        } else {
          setCoords(null);
        }
      } catch {
        if (!cancelled) setCoords(null);
      } finally {
        if (!cancelled) setMapLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, trimmedAddress]);

  const openingHoursRows = useMemo(() => {
    const byDay = new Map<
      number,
      { isOpen: boolean; openTime: string; closeTime: string }
    >();
    if (Array.isArray(branchHours)) {
      for (const entry of branchHours) {
        if (typeof entry?.dayOfWeek !== 'number') continue;
        byDay.set(entry.dayOfWeek, {
          isOpen: entry.isOpen === true,
          openTime: normalizeDayTime(entry.openTime),
          closeTime: normalizeDayTime(entry.closeTime),
        });
      }
    }

    return Array.from({ length: 7 }, (_, dayOfWeek) => {
      // Sunday-first labels matching Branch.dayOfWeek (0 = Sunday).
      const date = new Date(2024, 0, 7 + dayOfWeek);
      const day = date.toLocaleDateString(i18n.language, { weekday: 'long' });
      const hours = byDay.get(dayOfWeek);
      if (!hours?.isOpen) {
        return { day, hours: t('branchClosed'), closed: true };
      }
      const openTime = hours.openTime || '—';
      const closeTime = hours.closeTime || '—';
      return {
        day,
        hours: `${openTime} - ${closeTime}`,
        closed: false,
      };
    });
  }, [branchHours, i18n.language, t]);

  const directionsUrl = trimmedAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        trimmedAddress
      )}`
    : null;

  const sheetStyle = useMemo(
    () => buildCustomerLightSurfaceVars() as CSSProperties,
    []
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full max-w-[min(100vw,480px)] flex-col gap-0 border-0 bg-background p-0 text-foreground sm:max-w-[480px]"
        style={sheetStyle}
      >
        <div className="flex items-center justify-between border-b border-[#ececf0] bg-white px-5 py-4">
          <SheetTitle className="text-base font-bold uppercase tracking-wide text-[#1f1f2e]">
            {t('orderInformationTitle')}
          </SheetTitle>
          <SheetClose className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#1f1f2e] transition hover:bg-[#f4f4f6]">
            <X className="h-5 w-5" />
            <span className="sr-only">{t('close')}</span>
          </SheetClose>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#f4f4f6] p-4">
          <div className="overflow-hidden rounded-xl bg-white shadow-sm">
            {coords ? (
              <iframe
                title={trimmedTitle || t('orderInformationTitle')}
                src={buildOsmEmbedUrl(coords)}
                className="h-44 w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div className="flex h-44 items-center justify-center bg-[#e8eaef] text-sm text-[#8e8e9a]">
                {mapLoading
                  ? t('orderInformationMapLoading')
                  : t('orderInformationMapUnavailable')}
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-3 rounded-xl bg-white p-4 shadow-sm">
            <span
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: `${ORDER_ACCENT_GOLD}33` }}
            >
              <MapPin
                className="h-4 w-4"
                style={{ color: ORDER_ACCENT_GOLD }}
                strokeWidth={2.25}
              />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-primary">
                {trimmedTitle || t('storeAddress')}
              </p>
              {trimmedAddress ? (
                <p className="mt-1 text-sm leading-relaxed text-primary/80">
                  {trimmedAddress}
                </p>
              ) : (
                <p className="mt-1 text-sm text-[#8e8e9a]">
                  {t('orderInformationAddressUnavailable')}
                </p>
              )}
            </div>
          </div>

          {directionsUrl ? (
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex h-12 w-full items-center justify-center rounded-xl text-sm font-bold text-primary transition hover:brightness-[0.98]"
              style={{ backgroundColor: ORDER_ACCENT_GOLD }}
            >
              {t('orderGettingThere')}
            </a>
          ) : null}

          <div className="mt-4 overflow-hidden rounded-xl bg-white shadow-sm">
            <p className="border-b border-[#ececf0] px-4 py-3 text-sm font-bold text-primary">
              {t('orderOpeningTime')}
            </p>
            <div className="divide-y divide-[#ececf0]">
              {openingHoursRows.map((row) => (
                <div
                  key={row.day}
                  className="flex items-center gap-3 px-4 py-3 text-sm text-primary"
                >
                  <span className="min-w-0 flex-1 capitalize">{row.day}</span>
                  <Clock
                    className="h-4 w-4 shrink-0"
                    style={{ color: ORDER_ACCENT_GOLD }}
                    strokeWidth={2}
                  />
                  <span
                    className={`shrink-0 font-medium ${
                      row.closed ? 'text-[#8e8e9a]' : ''
                    }`}
                  >
                    {row.hours}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
