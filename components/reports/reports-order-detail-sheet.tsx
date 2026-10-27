'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Loader2, Printer } from 'lucide-react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';

import { OrderCustomerExtras } from '@/components/order/order-customer-extras';
import { ProductLineDetails } from '@/components/orders/product-line-details';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { restaurantOrderApiPath } from '@/lib/dashboard-paths';
import { apiErrorMessage } from '@/lib/api-error-message';
import { salesOrderMethodLabel } from '@/lib/order-fulfillment';
import { printPosOrderReceipt } from '@/lib/pos-order-receipt-print';
import { receiptLinesFromOrderItem } from '@/lib/receipt-item-lines';
import { paymentMethodToMode } from '@/lib/pos-order-lines';
import { cn } from '@/lib/utils';
import { salesOrderStatusBucket } from '@/lib/sales-order-status';

export type ReportsOrderDetail = {
  id: string;
  shortOrderId?: string | null;
  ticketNumber?: number | null;
  total: number;
  status: string;
  sourceType: string;
  address: string | null;
  tableLabel?: string | null;
  cutleryRequested?: boolean;
  customerComment?: string | null;
  taxAmount: number;
  discountAmount: number;
  serviceChargeAmount?: number;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
  } | null;
  items: Array<{
    id: string;
    quantity: number;
    price: number;
    menuItem: { id: string; name: string };
    modifiers?: Array<{
      id: string;
      name: string;
      quantity: number;
      unitPrice: number;
      menuItemId?: string | null;
      groupName?: string | null;
    }>;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    status: string;
    method: string;
    createdAt: string;
  }>;
};

type Props = {
  orderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formatMoney: (n: number | null | undefined) => string;
  brandName: string;
  branchName?: string | null;
  logoUrl?: string | null;
  currencyCode?: string;
  countryCode?: string;
  /** When true, print as soon as detail finishes loading. */
  autoPrint?: boolean;
};

function StatusBadge({ status }: { status: string }) {
  const bucket = salesOrderStatusBucket(status);
  return (
    <Badge
      variant="outline"
      className={cn(
        'rounded-full border-0 px-3 py-0.5 text-xs font-semibold capitalize',
        bucket === 'completed' &&
          'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
        bucket === 'pending' &&
          'bg-amber-500/15 text-amber-800 dark:text-amber-400',
        bucket === 'canceled' &&
          'bg-rose-500/15 text-rose-700 dark:text-rose-400'
      )}
    >
      {status}
    </Badge>
  );
}

function channelLabel(sourceType: string): string {
  const s = String(sourceType ?? '').toUpperCase();
  if (s === 'ONLINE') return 'Online';
  if (s === 'POS') return 'POS';
  if (s === 'KIOSK') return 'Kiosk';
  return sourceType || '—';
}

export function printReportsOrderDetail(
  detail: ReportsOrderDetail,
  opts: {
    brandName: string;
    branchName?: string | null;
    logoUrl?: string | null;
    currencyCode?: string;
    countryCode?: string;
  }
): boolean {
  const payment = detail.payments[0] ?? null;
  const subtotal = detail.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const orderMode =
    detail.tableLabel?.trim()
      ? 'tables'
      : detail.address?.toLowerCase().includes('deliver')
        ? 'delivery'
        : String(detail.sourceType ?? 'pos').toLowerCase();

  return printPosOrderReceipt({
    orderRef: detail.shortOrderId ?? detail.id.slice(0, 8).toUpperCase(),
    ticketNumber: detail.ticketNumber ?? null,
    brandName: opts.brandName,
    branchName: opts.branchName,
    logoUrl: opts.logoUrl,
    orderMode,
    paymentMethodLabel: payment?.method ?? 'Cash',
    tableLabel: detail.tableLabel ?? null,
    customerName: detail.customer?.name ?? null,
    customerPhone: detail.customer?.phone ?? null,
    address: detail.address,
    note: detail.customerComment?.trim() || null,
    cutleryRequested: detail.cutleryRequested === true,
    lines: detail.items.flatMap((item) =>
      receiptLinesFromOrderItem({
        name: item.menuItem.name,
        quantity: item.quantity,
        lineTotal: item.price * item.quantity,
        modifiers: item.modifiers,
      })
    ),
    subtotal,
    serviceChargeAmount: detail.serviceChargeAmount ?? 0,
    taxAmount: detail.taxAmount ?? 0,
    discountAmount: detail.discountAmount ?? 0,
    grandTotal: detail.total,
    paidAmount: payment?.amount ?? detail.total,
    paymentMode: paymentMethodToMode(payment?.method),
    currencyCode: opts.currencyCode,
    countryCode: opts.countryCode,
  });
}

export function ReportsOrderDetailSheet({
  orderId,
  open,
  onOpenChange,
  formatMoney,
  brandName,
  branchName,
  logoUrl,
  currencyCode,
  countryCode,
  autoPrint = false,
}: Props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [detail, setDetail] = useState<ReportsOrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const autoPrintDoneRef = useRef(false);
  const printOptsRef = useRef({
    brandName,
    branchName,
    logoUrl,
    currencyCode,
    countryCode,
  });
  printOptsRef.current = {
    brandName,
    branchName,
    logoUrl,
    currencyCode,
    countryCode,
  };

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    setDetail(null);
    try {
      const res = await axios.get<ReportsOrderDetail>(
        restaurantOrderApiPath(id)
      );
      setDetail(res.data);
      return res.data;
    } catch (e) {
      setDetail(null);
      setError(
        apiErrorMessage(e, t('dashboard.reports.couldNotLoadOrder'))
      );
      return null;
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!open || !orderId) return;
    autoPrintDoneRef.current = false;
    let cancelled = false;
    void (async () => {
      const loaded = await load(orderId);
      if (cancelled || !loaded || !autoPrint || autoPrintDoneRef.current) {
        return;
      }
      autoPrintDoneRef.current = true;
      setPrinting(true);
      try {
        const ok = printReportsOrderDetail(loaded, printOptsRef.current);
        if (!ok) {
          toast.error(t('dashboard.reports.couldNotPrintOrder'));
        }
      } finally {
        setPrinting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, orderId, load, autoPrint, t]);

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setDetail(null);
      setError(null);
      autoPrintDoneRef.current = false;
    }
  }

  async function handlePrint() {
    if (!detail) return;
    setPrinting(true);
    try {
      const ok = printReportsOrderDetail(detail, {
        brandName,
        branchName,
        logoUrl,
        currencyCode,
        countryCode,
      });
      if (!ok) toast.error(t('dashboard.reports.couldNotPrintOrder'));
    } finally {
      setPrinting(false);
    }
  }

  const methodLabel = detail
    ? salesOrderMethodLabel({
        address: detail.address,
        sourceType: detail.sourceType,
        tableLabel: detail.tableLabel,
      })
    : null;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader className="space-y-3">
          <div className="flex items-start justify-between gap-3 pr-6">
            <SheetTitle>{t('dashboard.reports.orderDetails')}</SheetTitle>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0 gap-1.5"
              disabled={!detail || loading || printing}
              onClick={() => void handlePrint()}
            >
              {printing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Printer className="h-4 w-4" />
              )}
              {t('dashboard.reports.printOrder')}
            </Button>
          </div>
        </SheetHeader>

        <div className="mt-4 flex-1 overflow-y-auto pr-1">
          {loading ? (
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
          ) : null}

          {!loading && error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}

          {!loading && detail ? (
            <div className="space-y-4 text-sm">
              {methodLabel ? (
                <div className="bg-primary/5 px-2 py-2 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('dashboard.reports.colChannel')}
                  </p>
                  <p className="mt-2 text-xl font-bold tracking-tight text-foreground">
                    {methodLabel}
                  </p>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-muted-foreground">
                    {t('dashboard.reports.colTicket')}
                  </p>
                  <p className="font-semibold tabular-nums">
                    {detail.ticketNumber != null
                      ? `#${detail.ticketNumber}`
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    {t('dashboard.records.colTracking')}
                  </p>
                  <p className="font-mono text-xs">
                    {(detail.shortOrderId ?? detail.id.slice(0, 6)).toUpperCase()}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    {t('dashboard.reports.colTotal')}
                  </p>
                  <p className="font-semibold tabular-nums">
                    {formatMoney(detail.total)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    {t('dashboard.reports.colOrderStatus')}
                  </p>
                  <StatusBadge status={detail.status} />
                </div>
                <div>
                  <p className="text-muted-foreground">
                    {t('dashboard.reports.colChannel')}
                  </p>
                  <p>{channelLabel(detail.sourceType)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    {t('dashboard.common.date')}
                  </p>
                  <p>{new Date(detail.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    {t('dashboard.reports.colPaymentStatus')}
                  </p>
                  <p className="font-medium">
                    {detail.payments[0]?.status ?? '—'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">
                    {t('dashboard.reports.paymentMethod')}
                  </p>
                  <p>{detail.payments[0]?.method ?? '—'}</p>
                </div>
              </div>

              <div className="rounded-lg border p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  {t('dashboard.reports.financialSummary')}
                </p>
                <p>
                  {t('dashboard.reports.tax')}: {formatMoney(detail.taxAmount)}
                </p>
                <p>
                  {t('dashboard.reports.discount')}:{' '}
                  {formatMoney(detail.discountAmount)}
                </p>
                {(detail.serviceChargeAmount ?? 0) > 0 ? (
                  <p>
                    {t('dashboard.reports.serviceCharge')}:{' '}
                    {formatMoney(detail.serviceChargeAmount)}
                  </p>
                ) : null}
              </div>

              {detail.customer ? (
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t('dashboard.reports.customer')}
                  </p>
                  <p className="font-medium">{detail.customer.name}</p>
                  <p className="text-muted-foreground">
                    {detail.customer.phone}
                  </p>
                  {detail.customer.email ? (
                    <p className="text-muted-foreground">
                      {detail.customer.email}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {detail.address ? (
                <div className="rounded-lg border p-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t('dashboard.reports.addressSnapshot')}
                  </p>
                  <pre className="whitespace-pre-wrap text-xs text-muted-foreground">
                    {detail.address}
                  </pre>
                </div>
              ) : null}

              <OrderCustomerExtras
                cutleryRequested={detail.cutleryRequested}
                customerComment={detail.customerComment}
              />

              <div>
                <p className="mb-2 font-medium">
                  {t('dashboard.reports.lineItems')}
                </p>
                {detail.items.length === 0 ? (
                  <p className="text-muted-foreground">
                    {t('dashboard.reports.noLineItems')}
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        <TableHead>{t('dashboard.reports.item')}</TableHead>
                        <TableHead className="text-right">
                          {t('dashboard.reports.colQty')}
                        </TableHead>
                        <TableHead className="text-right">
                          {t('dashboard.reports.colTotal')}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.items.map((it, i) => (
                        <TableRow key={it.id}>
                          <TableCell className="tabular-nums text-muted-foreground">
                            {i + 1}
                          </TableCell>
                          <TableCell>
                            <ProductLineDetails
                              productName={it.menuItem.name}
                              quantity={it.quantity}
                              orderModifiers={it.modifiers ?? []}
                              showQuantityOnModifiers
                              titleClassName="font-medium"
                              lineClassName="pl-3 text-xs text-muted-foreground"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            {it.quantity}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatMoney(it.price * it.quantity)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              {detail.payments.length > 0 ? (
                <div>
                  <p className="mb-2 font-medium">
                    {t('dashboard.reports.payments')}
                  </p>
                  <ul className="space-y-1 text-muted-foreground">
                    {detail.payments.map((p) => (
                      <li key={p.id}>
                        {formatMoney(p.amount)} · {p.method} · {p.status}{' '}
                        <span className="text-xs">
                          ({new Date(p.createdAt).toLocaleString()})
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
