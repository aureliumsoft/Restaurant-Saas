export type SalesOrderRow =
  | {
      id: string;
      kind: 'menu_order';
      trackingToken?: string | null;
      ticketNumber?: number | null;
      sourceType: string;
      total: number;
      status: string;
      paymentStatus?: string | null;
      transactionId?: string | null;
      /** Delivery / Pickup (online) or Dine in / Take away (kiosk), etc. */
      method?: string | null;
      createdAt: string;
    }
  | {
      id: string;
      kind: 'sale_transaction';
      trackingToken?: string | null;
      ticketNumber?: number | null;
      sourceType: string;
      total: number | null;
      status: string;
      transactionId?: string | null;
      createdAt: string;
    };

export type SalesChannelStats = {
  totalOrders: number;
  totalAmount: number;
  revenueAmount: number;
  revenueOrders: number;
  pending: { count: number; amount: number };
  canceled: { count: number; amount: number };
};

export type SalesOrdersStats = {
  online: SalesChannelStats;
  pos: SalesChannelStats;
  kiosk: SalesChannelStats;
};

export type SalesOrdersPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type SalesOrdersApiResponse = {
  orders: SalesOrderRow[];
  stats: SalesOrdersStats;
  pagination: SalesOrdersPagination;
  /** @deprecated Use `orders` + `pagination` */
  onlineOrders?: SalesOrderRow[];
  /** @deprecated */
  posOrders?: SalesOrderRow[];
  /** @deprecated */
  kioskOrders?: SalesOrderRow[];
};

export type SalesOrdersTab = 'online' | 'pos' | 'kiosk';
export type SalesOrdersStatusFilter = 'all' | 'completed' | 'pending' | 'canceled';
/** `today` = current calendar day; `overall` = all dates. */
export type SalesOrdersPeriodFilter = 'today' | 'overall';
