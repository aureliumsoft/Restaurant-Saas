export type OrderInfo = {
  mode: 'delivery' | 'pickUp';
  restaurantName?: string;
  storeId?: string;
  storeName?: string;
  storeAddress?: string;
  address?: string;
  apartment?: string;
  gateCode?: string;
  addressName?: string;
  customerPhone?: string;
  /** Path-based storefront (`/{slug}`); loads menu via `/api/customer/menu?slug=` */
  restaurantSlug?: string;
};
