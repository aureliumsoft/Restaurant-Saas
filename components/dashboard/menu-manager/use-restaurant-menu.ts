'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

import type { RestaurantMenuData } from './types';

export function useRestaurantMenu() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<RestaurantMenuData | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/restaurant/menu');
      const payload = res.data?.data as RestaurantMenuData | undefined;
      setData(
        payload
          ? {
              id: payload.id,
              menus: payload.menus ?? [],
              inventoryItems: payload.inventoryItems ?? [],
            }
          : null
      );
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Failed to load menu');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    loading,
    categories: data?.menus ?? [],
    inventoryItems: data?.inventoryItems ?? [],
    load,
    restaurantId: data?.id ?? null,
  };
}
