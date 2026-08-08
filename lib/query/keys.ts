export const queryKeys = {
  bootstrap: (branchId?: string | null) =>
    ['me', 'bootstrap', branchId ?? 'all'] as const,
  regional: () => ['restaurant', 'regional'] as const,
  branding: () => ['restaurant', 'branding'] as const,
  dashboardPermissions: () => ['me', 'dashboard-permissions'] as const,
  kdsTickets: (status: string) => ['kds', 'tickets', status] as const,
  kdsManager: () => ['kds', 'manager-orders'] as const,
  orderDisplay: (date?: string) => ['order-display', date ?? 'today'] as const,
  kioskPendingCash: (branchId?: string | null) =>
    ['kiosk', 'pending-cash', branchId ?? 'all'] as const,
  tableOpenOrders: (branchId?: string | null) =>
    ['pos', 'table-open-orders', branchId ?? 'all'] as const,
  posRecentOrders: (branchId?: string | null) =>
    ['pos', 'recent-orders', branchId ?? 'all'] as const,
  salesOrders: (params: string) => ['sales', 'orders', params] as const,
} as const;
