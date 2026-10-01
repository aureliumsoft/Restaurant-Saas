'use client';

import { useEffect, useRef } from 'react';
import {
  icon,
  map as createMap,
  marker as createMarker,
  tileLayer,
  type Map as LeafletMap,
  type Marker as LeafletMarker,
} from 'leaflet';
import 'leaflet/dist/leaflet.css';

import type { MapCoords } from '@/lib/geo/nominatim';

const markerIcon = icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export type AddressMapPickerMapProps = {
  center: MapCoords;
  marker: MapCoords | null;
  zoom?: number;
  onPick: (coords: MapCoords) => void;
  className?: string;
};

/**
 * Imperative Leaflet map (not react-leaflet MapContainer).
 * Avoids "Map container is already initialized" under React Strict Mode /
 * dialog remounts by always calling map.remove() on cleanup.
 */
export default function AddressMapPickerMap({
  center,
  marker,
  zoom = 14,
  onPick,
  className,
}: AddressMapPickerMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const onPickRef = useRef(onPick);
  const initialRef = useRef({ center, zoom });

  onPickRef.current = onPick;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Strict Mode remount can leave Leaflet's internal id on the node.
    const leafletEl = el as HTMLDivElement & { _leaflet_id?: number };
    if (leafletEl._leaflet_id) {
      delete leafletEl._leaflet_id;
    }

    const { center: start, zoom: startZoom } = initialRef.current;
    const map = createMap(el, { scrollWheelZoom: true }).setView(
      [start.lat, start.lon],
      startZoom
    );

    tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    map.on('click', (e) => {
      onPickRef.current({ lat: e.latlng.lat, lon: e.latlng.lng });
    });

    mapRef.current = map;
    const sizeTimer = window.setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      window.clearTimeout(sizeTimer);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setView([center.lat, center.lon], zoom, { animate: true });
  }, [center.lat, center.lon, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!marker) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    if (!markerRef.current) {
      const next = createMarker([marker.lat, marker.lon], {
        icon: markerIcon,
        draggable: true,
      }).addTo(map);
      next.on('dragend', () => {
        const ll = next.getLatLng();
        onPickRef.current({ lat: ll.lat, lon: ll.lng });
      });
      markerRef.current = next;
      return;
    }

    markerRef.current.setLatLng([marker.lat, marker.lon]);
  }, [marker?.lat, marker?.lon]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const id = window.setTimeout(() => map.invalidateSize(), 120);
    return () => window.clearTimeout(id);
  }, [center.lat, center.lon, zoom, marker?.lat, marker?.lon]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height: '100%', width: '100%', minHeight: '12rem' }}
    />
  );
}
