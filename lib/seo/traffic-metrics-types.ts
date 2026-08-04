export type GscTotals = {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type Ga4Totals = {
  users: number;
  sessions: number;
  pageViews: number;
};

export type TrafficMetricsReport = {
  days: number;
  startDate: string;
  endDate: string;
  cachedAt: string;
  cacheHit: boolean;
  authConfigured: boolean;
  gsc: {
    configured: boolean;
    reason?: string;
  } & Partial<GscTotals>;
  ga4: {
    configured: boolean;
    reason?: string;
  } & Partial<Ga4Totals>;
};
