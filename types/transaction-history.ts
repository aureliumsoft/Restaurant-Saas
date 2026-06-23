export type TransactionHistoryKind = 'ORDER' | 'SUBSCRIPTION' | 'REGISTER';

export type TransactionHistoryRow = {
  key: string;
  kind: TransactionHistoryKind;
  transactionId: string;
  referenceId: string | null;
  shortOrderId?: string | null;
  ticketNumber?: number | null;
  amount: number | null;
  currency: string;
  status: string;
  method: string | null;
  source: string;
  note: string | null;
  customerName: string | null;
  createdAt: string;
};

export type TransactionHistoryResponse = {
  data: TransactionHistoryRow[];
  meta: {
    page: number;
    take: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
    canViewHistorical?: boolean;
    dataScope?: 'all' | 'today';
  };
};

