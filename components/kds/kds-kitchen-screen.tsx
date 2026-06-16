'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock3,
  Loader2,
  Check,
  Trash2,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  KdsOrderActionDialog,
  type KdsOrderActionKind,
} from '@/components/kds/kds-order-action-dialog';
import { OrderCustomerExtras } from '@/components/order/order-customer-extras';
import { kdsAxiosErrorMessage } from '@/lib/kds-api-errors';

type Ticket = {
  id: string;
  orderId: string;
  status: string;
  selectedMinutes: number;
  startedAt: string;
  createdAt: string;
  sourceType: string;
  orderTotal: number;
  customerName: string | null;
  cutleryRequested?: boolean;
  customerComment?: string | null;
  /** Daily token number (resets per restaurant per day). */
  ticketNumber: number | null;
  /** 6-char public tracking id from the order. */
  shortOrderId: string | null;
  items: { id: string; productName: string; quantity: number }[];
};

function tokenLabel(t: {
  ticketNumber: number | null;
  shortOrderId: string | null;
  orderId: string;
}): string {
  if (typeof t.ticketNumber === 'number' && t.ticketNumber >= 0) {
    return String(t.ticketNumber).padStart(2, '0');
  }
  return (t.shortOrderId ?? t.orderId.slice(0, 6)).toUpperCase();
}

function trackingLabel(t: {
  shortOrderId: string | null;
  orderId: string;
}): string {
  return (t.shortOrderId ?? t.orderId.slice(0, 6)).toUpperCase();
}

type BoardLikeLines = {
  main: { name: string; quantity: number } | null;
  nested: { name: string; quantity: number }[];
};

function normalizeTicketItem(rawName: string, rawQty: number) {
  const trimmed = String(rawName || '').trim();
  const nested = trimmed.startsWith('+');
  const withoutPrefix = nested ? trimmed.replace(/^\+\s*/, '') : trimmed;
  const trailingQty = withoutPrefix.match(/^(.*)\s+x(\d+)$/i);

  if (!trailingQty) {
    return {
      isNested: nested,
      name: withoutPrefix,
      quantity: rawQty,
    };
  }

  const parsed = Number(trailingQty[2]);
  const safeParsed = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  const baseName = trailingQty[1].trim();
  const effectiveQty = rawQty > 1 ? rawQty * safeParsed : safeParsed;

  return {
    isNested: nested,
    name: baseName || withoutPrefix,
    quantity: effectiveQty,
  };
}

function normalizeRecommendedDisplay(rawName: string, rawQty: number) {
  const normalized = normalizeTicketItem(rawName, rawQty);
  return {
    ...normalized,
    name: normalized.name.replace(/\s{2,}/g, ' ').trim(),
  };
}

function splitTopLevel(input: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let buf = '';
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]!;
    if (ch === '(') depth += 1;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === sep && depth === 0) {
      if (buf.trim()) out.push(buf.trim());
      buf = '';
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

function extractTopLevelParenSegments(input: string) {
  const segments: Array<{ start: number; end: number; content: string }> = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]!;
    if (ch === '(') {
      if (depth === 0) start = i;
      depth += 1;
      continue;
    }
    if (ch === ')') {
      if (depth > 0) depth -= 1;
      if (depth === 0 && start >= 0) {
        segments.push({
          start,
          end: i,
          content: input.slice(start + 1, i).trim(),
        });
        start = -1;
      }
    }
  }
  return segments;
}

function parseQtySuffix(input: string, fallbackQty: number) {
  const m = input.match(/^(.*)\s+x(\d+)$/i);
  if (!m) return { name: input.trim(), qty: fallbackQty };
  const n = Number(m[2]);
  const safe = Number.isFinite(n) && n > 0 ? n : 1;
  return { name: m[1].trim(), qty: safe };
}

function toBoardLikeLines(rawName: string, rawQty: number): BoardLikeLines {
  const normalized = normalizeRecommendedDisplay(rawName, rawQty);
  if (normalized.isNested) {
    return {
      main: null,
      nested: [{ name: normalized.name, quantity: normalized.quantity }],
    };
  }

  const segments = extractTopLevelParenSegments(normalized.name);
  const recommendationSegments = segments.filter(
    (s) => s.content.includes(':') || s.content.includes(';')
  );
  if (recommendationSegments.length === 0) {
    return {
      main: { name: normalized.name, quantity: normalized.quantity },
      nested: [],
    };
  }

  let baseName = normalized.name;
  recommendationSegments
    .sort((a, b) => b.start - a.start)
    .forEach((s) => {
      baseName =
        `${baseName.slice(0, s.start)}${baseName.slice(s.end + 1)}`.trim();
    });
  baseName = baseName.replace(/\s{2,}/g, ' ').trim();

  const nested: { name: string; quantity: number }[] = [];
  for (const seg of recommendationSegments) {
    const parts = splitTopLevel(seg.content.replace(/,\s*/g, ';'), ';');
    for (const part of parts) {
      const pair = part.match(/^([^:]+):\s*(.+)$/);
      const valuesRaw = pair ? pair[2] : part;
      const values = splitTopLevel(valuesRaw, ',');
      for (const v of values) {
        const parsed = parseQtySuffix(v.trim(), 1);
        if (!parsed.name) continue;
        nested.push({ name: parsed.name, quantity: parsed.qty });
      }
    }
  }

  return {
    main: { name: baseName || normalized.name, quantity: normalized.quantity },
    nested,
  };
}

type MenuItemRow = {
  id: string;
  name: string;
  price: number;
  salePrice: number | null;
};

type MenuPayload = {
  menus?: { items?: MenuItemRow[] }[];
};

/** Same rule as kiosk “Recommended”: items with an active sale price. */
function recommendedItemNames(menu: MenuPayload | null | undefined): string[] {
  if (!menu?.menus?.length) return [];
  const byId = new Map<string, string>();
  for (const cat of menu.menus) {
    for (const it of cat.items ?? []) {
      if (
        !it?.id ||
        !it.name?.trim() ||
        it.salePrice == null ||
        it.salePrice <= 0 ||
        it.salePrice >= it.price
      ) {
        continue;
      }
      if (!byId.has(it.id)) byId.set(it.id, it.name.trim());
    }
  }
  return [...byId.values()].sort((a, b) => a.localeCompare(b));
}

function fmt(v: number) {
  return v.toLocaleString('en-IE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function remainingSeconds(
  startedAtIso: string,
  selectedMinutes: number,
  nowMs: number
) {
  const started = new Date(startedAtIso).getTime();
  const end = started + selectedMinutes * 60_000;
  return Math.floor((end - nowMs) / 1000);
}

function formatCountdown(sec: number) {
  const abs = Math.abs(sec);
  const mm = Math.floor(abs / 60)
    .toString()
    .padStart(2, '0');
  const ss = Math.floor(abs % 60)
    .toString()
    .padStart(2, '0');
  return sec < 0 ? `-${mm}:${ss}` : `${mm}:${ss}`;
}

export function KdsKitchenScreen() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [recommendedNames, setRecommendedNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCompletingTicketId, setActiveCompletingTicketId] = useState<
    string | null
  >(null);
  const [activeCompleteCount, setActiveCompleteCount] = useState(0);
  const [activeCancelingTicketId, setActiveCancelingTicketId] = useState<
    string | null
  >(null);
  const [activeCancelCount, setActiveCancelCount] = useState(0);
  const [pendingAction, setPendingAction] = useState<{
    kind: KdsOrderActionKind;
    ticketId: string;
    label: string;
  } | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await axios.get<{ data: Ticket[] }>(
        '/api/restaurant/kds/tickets?status=making'
      );
      setTickets(res.data.data ?? []);
    } catch (err) {
      setTickets([]);
      toast.error(kdsAxiosErrorMessage(err, 'load', 'Could not load kitchen tickets.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onBranch = () => void load();
    window.addEventListener('branch-changed', onBranch);
    return () => window.removeEventListener('branch-changed', onBranch);
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      void load();
    }, 8000);
    return () => clearInterval(t);
  }, [load]);

  const sorted = useMemo(
    () =>
      [...tickets].sort(
        (a, b) =>
          new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
      ),
    [tickets]
  );

  async function updateStatus(
    ticketId: string,
    status: 'completed' | 'canceled'
  ): Promise<boolean> {
    if (status === 'completed') {
      setActiveCompleteCount((prev) => prev + 1);
      setActiveCompletingTicketId(ticketId);
    } else {
      setActiveCancelCount((prev) => prev + 1);
      setActiveCancelingTicketId(ticketId);
    }
    try {
      await axios.patch(`/api/restaurant/kds/tickets/${ticketId}`, { status });
      toast.success(
        status === 'completed' ? 'Order marked complete' : 'Order canceled'
      );
      await load();
      return true;
    } catch (err) {
      toast.error(
        kdsAxiosErrorMessage(
          err,
          status === 'completed' ? 'complete' : 'cancel'
        )
      );
      return false;
    } finally {
      if (status === 'completed') {
        setActiveCompleteCount((prev) => {
          const next = Math.max(0, prev - 1);
          if (next === 0) setActiveCompletingTicketId(null);
          return next;
        });
      } else {
        setActiveCancelCount((prev) => {
          const next = Math.max(0, prev - 1);
          if (next === 0) setActiveCancelingTicketId(null);
          return next;
        });
      }
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 text-foreground md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kitchen Display</h1>
          <p className="text-sm text-muted-foreground">
            Showing all making orders
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void load()}
          disabled={refreshing}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
          />
          Refresh
        </Button>
      </div>

      {recommendedNames.length > 0 ? (
        <Card className="mb-4 border-dashed">
          <CardContent className="py-3 text-sm leading-snug text-foreground">
            {recommendedNames.join(', ')}
          </CardContent>
        </Card>
      ) : null}

      {loading ? (
        <Loader2 className="animate-spin text-primary text-center mx-auto" />
      ) : sorted.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            No active making orders.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sorted.map((t) => {
            const left = remainingSeconds(
              t.startedAt,
              t.selectedMinutes,
              nowMs
            );
            const overdue = left < 0;
            return (
              <Card key={t.id} className={overdue ? 'border-red-500' : ''}>
                <CardContent className="pt-5">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                            <div className="flex items-baseline gap-2">
                              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                                Token
                              </span>
                              <span className="font-mono text-3xl font-extrabold leading-none tabular-nums">
                                {tokenLabel(t)}
                              </span>
                            </div>
                            <span className="hidden h-5 w-px bg-border sm:inline-block" />
                            <div className="flex items-baseline gap-2">
                              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                                Tracking
                              </span>
                              <span className="font-mono text-sm font-semibold uppercase tracking-wider">
                                {trackingLabel(t)}
                              </span>
                            </div>
                          </div>
                          <p className="text-sm font-medium">
                            {t.customerName || 'Walk-in'}
                          </p>
                        </div>
                        <Badge variant={overdue ? 'destructive' : 'secondary'}>
                          {t.sourceType}
                        </Badge>
                      </div>

                      <OrderCustomerExtras
                        cutleryRequested={t.cutleryRequested}
                        customerComment={t.customerComment}
                        compact
                      />

                      <div className="space-y-1">
                        {t.items.map((it) => {
                          const lines = toBoardLikeLines(
                            it.productName,
                            it.quantity
                          );
                          return (
                            <div key={it.id} className="text-sm leading-snug">
                              {lines.main ? (
                                <p>
                                  <span className="font-semibold tabular-nums">
                                    {lines.main.quantity}×
                                  </span>{' '}
                                  {lines.main.name}
                                </p>
                              ) : null}
                              {lines.nested.map((line, idx) => (
                                <p
                                  key={`${it.id}-nested-${idx}`}
                                  className="pl-4 text-muted-foreground"
                                >
                                  <span className="font-semibold tabular-nums">
                                    {line.quantity}×
                                  </span>{' '}
                                  {line.name}
                                </p>
                              ))}
                            </div>
                          );
                        })}
                      </div>

                      <p className="text-xs font-semibold">
                        €{fmt(t.orderTotal)}
                      </p>
                    </div>

                    <div className="flex flex-col justify-between gap-3">
                      <div className="flex items-center justify-between rounded-md border p-3">
                        <Clock3 className="w-12 h-12 text-muted-foreground" />
                        <div className="flex flex-col justify-between">
                          <p className="text-xs text-muted-foreground">
                            Selected time
                          </p>
                          <p
                            className={`text-2xl font-bold tabular-nums ${overdue ? 'text-red-500' : ''}`}
                          >
                            {formatCountdown(left)}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            Target: {t.selectedMinutes}m
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        <Button
                          type="button"
                          size="lg"
                          className="h-12 justify-start gap-2 text-base"
                          disabled={
                            (activeCompleteCount > 0 &&
                              activeCompletingTicketId !== t.id) ||
                            (activeCompletingTicketId !== null &&
                              activeCompletingTicketId === t.id) ||
                            (activeCancelCount > 0 &&
                              activeCancelingTicketId === t.id)
                          }
                          onClick={() =>
                            setPendingAction({
                              kind: 'complete',
                              ticketId: t.id,
                              label: tokenLabel(t),
                            })
                          }
                        >
                          {activeCompleteCount > 0 &&
                          activeCompletingTicketId === t.id ? (
                            <>
                              <Loader2 className="mr-2 h-5 w-5 animate-spin" />{' '}
                              <span className="text-sm font-medium">
                                Completing...
                              </span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="mr-2 h-5 w-5" />{' '}
                              <span className="text-sm font-medium">
                                Complete
                              </span>
                            </>
                          )}
                        </Button>
                        <Button
                          type="button"
                          size="lg"
                          variant="destructive"
                          className="h-12 justify-start gap-2 text-base"
                          disabled={
                            (activeCancelCount > 0 &&
                              activeCancelingTicketId !== t.id) ||
                            (activeCancelingTicketId !== null &&
                              activeCancelingTicketId === t.id) ||
                            (activeCompleteCount > 0 &&
                              activeCompletingTicketId === t.id)
                          }
                          onClick={() =>
                            setPendingAction({
                              kind: 'cancel',
                              ticketId: t.id,
                              label: tokenLabel(t),
                            })
                          }
                        >
                          {activeCancelCount > 0 &&
                          activeCancelingTicketId === t.id ? (
                            <>
                              <Loader2 className="mr-2 h-5 w-5 animate-spin" />{' '}
                              <span className="text-sm font-medium">
                                Canceling...
                              </span>
                            </>
                          ) : (
                            <>
                              <XCircle className="mr-2 h-5 w-5" />{' '}
                              <span className="text-sm font-medium">
                                Cancel Order
                              </span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <KdsOrderActionDialog
        open={pendingAction !== null}
        kind={pendingAction?.kind ?? 'complete'}
        itemName={pendingAction?.label}
        loading={
          pendingAction?.kind === 'complete'
            ? activeCompleteCount > 0 &&
              activeCompletingTicketId === pendingAction.ticketId
            : pendingAction?.kind === 'cancel'
              ? activeCancelCount > 0 &&
                activeCancelingTicketId === pendingAction.ticketId
              : false
        }
        onCancel={() => setPendingAction(null)}
        iconConfirm={
          pendingAction?.kind === 'complete' ? (
            <Check className="mr-2 h-4 w-4" />
          ) : (
            <Trash2 className="mr-2 h-4 w-4" />
          )
        }
        iconLoading={<Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        onConfirm={async () => {
          if (!pendingAction) return;
          const { kind, ticketId } = pendingAction;
          const ok = await updateStatus(
            ticketId,
            kind === 'complete' ? 'completed' : 'canceled'
          );
          if (ok) setPendingAction(null);
        }}
      />
    </div>
  );
}
