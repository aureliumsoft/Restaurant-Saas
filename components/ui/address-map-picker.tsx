'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslation } from 'react-i18next';
import { Loader2, MapPin, Navigation } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  defaultMapCenter,
  formatCoordsFallback,
  geocodeAddress,
  reverseGeocodeAddress,
  type MapCoords,
} from '@/lib/geo/nominatim';
import { cn } from '@/lib/utils';

const AddressMapPickerMap = dynamic(
  () => import('@/components/ui/address-map-picker-map'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-muted/30 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        Loading map…
      </div>
    ),
  }
);

export type AddressMapPickerProps = {
  value: string;
  onChange: (address: string) => void;
  countryCode?: string | null;
  disabled?: boolean;
  id?: string;
  label?: string;
  placeholder?: string;
  className?: string;
  mapClassName?: string;
};

export function AddressMapPicker({
  value,
  onChange,
  countryCode,
  disabled,
  id = 'address-map-picker',
  label,
  placeholder,
  className,
  mapClassName,
}: AddressMapPickerProps) {
  const { t } = useTranslation();
  const fallbackCenter = useMemo(
    () => defaultMapCenter(countryCode),
    [countryCode]
  );
  const [marker, setMarker] = useState<MapCoords | null>(null);
  const [center, setCenter] = useState<MapCoords>(fallbackCenter);
  const [zoom, setZoom] = useState(6);
  const [resolving, setResolving] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const lastResolvedAddress = useRef('');
  const skipNextGeocode = useRef(false);

  useEffect(() => {
    // Defer Leaflet until after paint so dialogs/portals don't trip hydration.
    const id = window.requestAnimationFrame(() => setMapReady(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    setCenter(fallbackCenter);
  }, [fallbackCenter]);

  /** Keep marker in sync when editing an existing address. */
  useEffect(() => {
    const trimmed = value.trim();
    if (!trimmed) {
      setMarker(null);
      lastResolvedAddress.current = '';
      return;
    }
    if (skipNextGeocode.current) {
      skipNextGeocode.current = false;
      lastResolvedAddress.current = trimmed;
      return;
    }
    if (trimmed === lastResolvedAddress.current) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void (async () => {
        setResolving(true);
        try {
          const hit = await geocodeAddress(trimmed, {
            countryCode: countryCode ?? undefined,
            signal: controller.signal,
          });
          if (!hit) return;
          lastResolvedAddress.current = trimmed;
          setMarker({ lat: hit.lat, lon: hit.lon });
          setCenter({ lat: hit.lat, lon: hit.lon });
          setZoom(16);
        } catch {
          /* ignore abort / network */
        } finally {
          setResolving(false);
        }
      })();
    }, 500);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [value, countryCode]);

  async function applyCoords(coords: MapCoords) {
    setMarker(coords);
    setCenter(coords);
    setZoom(17);
    setResolving(true);
    try {
      const labelText =
        (await reverseGeocodeAddress(coords)) ?? formatCoordsFallback(coords);
      skipNextGeocode.current = true;
      lastResolvedAddress.current = labelText;
      onChange(labelText);
    } catch {
      const fallback = formatCoordsFallback(coords);
      skipNextGeocode.current = true;
      lastResolvedAddress.current = fallback;
      onChange(fallback);
    } finally {
      setResolving(false);
    }
  }

  function useMyLocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void applyCoords({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        }).finally(() => setGeoLoading(false));
      },
      () => setGeoLoading(false),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }

  return (
    <div className={cn('grid gap-2', className)}>
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      <div className="relative">
        <Input
          id={id}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="street-address"
          onChange={(e) => onChange(e.target.value)}
          className="pr-10"
        />
        {resolving ? (
          <Loader2
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden
          />
        ) : (
          <MapPin
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {t('dashboard.branches.mapPickHint')}
      </p>
      <div
        className={cn(
          'relative overflow-hidden rounded-xl border border-input bg-muted/20',
          mapClassName ?? 'h-56 w-full'
        )}
      >
        {mapReady ? (
          <AddressMapPickerMap
            center={center}
            marker={marker}
            zoom={zoom}
            onPick={(coords) => {
              if (disabled) return;
              void applyCoords(coords);
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted/30 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            Loading map…
          </div>
        )}
        <div className="absolute right-2 top-2 z-[1000]">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={disabled || geoLoading}
            onClick={useMyLocation}
          >
            {geoLoading ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Navigation className="mr-2 h-3.5 w-3.5" aria-hidden />
            )}
            {t('dashboard.branches.useMyLocation')}
          </Button>
        </div>
      </div>
    </div>
  );
}
