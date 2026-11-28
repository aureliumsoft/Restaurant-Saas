import { normalizeUiLanguage } from '@/lib/i18n/language-cookie';
import type { UiLanguage } from '@/lib/i18n/ui-language';

export function resolveReceiptLang(lang?: string | null): UiLanguage {
  return normalizeUiLanguage(lang);
}

/** Order / kiosk receipt chrome (static labels). */
export type OrderReceiptLabels = {
  documentTitle: string;
  token: (n: number | string) => string;
  trackingId: string;
  mode: string;
  payment: string;
  status: string;
  statusPaid: string;
  table: string;
  customer: string;
  phone: string;
  address: string;
  cutlery: string;
  cutleryYes: string;
  note: string;
  item: string;
  qty: string;
  amt: string;
  noItems: string;
  subtotal: string;
  serviceCharge: string;
  tax: string;
  discount: string;
  paid: string;
  change: string;
  total: string;
  thankYou: string;
  na: string;
};

/** Shift end receipt chrome. */
export type ShiftReceiptLabels = {
  documentTitle: string;
  shiftTitle: string;
  shiftDetails: string;
  started: string;
  openedBy: string;
  status: string;
  orders: string;
  shiftOrders: string;
  ticketCol: string;
  timeCol: string;
  payCol: string;
  amt: string;
  noCompletedOrders: string;
  totalSales: string;
  cashReconciliation: string;
  previousCashLeft: string;
  lastShiftEnded: string;
  cashSales: string;
  cardOther: string;
  expectedInLocker: string;
  cashLeftInLocker: string;
  difference: string;
  differenceNote: string;
  endOfShift: string;
};

/** Combined labels used by POS order + shift printers. */
export type ReceiptLabels = OrderReceiptLabels &
  ShiftReceiptLabels & {
    orderTitle: string;
    kioskTitle: string;
    ticketLine: (n: number | string) => string;
    modes: Record<string, string>;
    payments: Record<string, string>;
    shiftStatuses: Record<string, string>;
  };

const EN_ORDER: OrderReceiptLabels = {
  documentTitle: 'Order Receipt',
  token: (n) => `Ticket: #${n}`,
  trackingId: 'Tracking ID',
  mode: 'Mode',
  payment: 'Payment',
  status: 'Status',
  statusPaid: 'paid',
  table: 'Table',
  customer: 'Customer',
  phone: 'Phone',
  address: 'Address',
  cutlery: 'Cutlery',
  cutleryYes: 'yes',
  note: 'Note',
  item: 'Item',
  qty: 'Qty',
  amt: 'Amt',
  noItems: 'No items',
  subtotal: 'Subtotal',
  serviceCharge: 'Service charge',
  tax: 'Tax',
  discount: 'Discount',
  paid: 'Paid',
  change: 'Change',
  total: 'Total',
  thankYou: 'Thank you!',
  na: 'N/A',
};

const ES_ORDER: OrderReceiptLabels = {
  documentTitle: 'Recibo del pedido',
  token: (n) => `Pedido: #${n}`,
  trackingId: 'ID de seguimiento',
  mode: 'Modo',
  payment: 'Pago',
  status: 'Estado',
  statusPaid: 'pagado',
  table: 'Mesa',
  customer: 'Cliente',
  phone: 'Teléfono',
  address: 'Dirección',
  cutlery: 'Cubiertos',
  cutleryYes: 'sí',
  note: 'Nota',
  item: 'Artículo',
  qty: 'Cant.',
  amt: 'Importe',
  noItems: 'Sin artículos',
  subtotal: 'Subtotal',
  serviceCharge: 'Cargo de servicio',
  tax: 'Impuestos',
  discount: 'Descuento',
  paid: 'Pagado',
  change: 'Cambio',
  total: 'Total',
  thankYou: '¡Gracias!',
  na: 'N/D',
};

const EN_MODES: Record<string, string> = {
  pos: 'POS',
  takeaway: 'Takeaway',
  'take away': 'Takeaway',
  'take-away': 'Takeaway',
  delivery: 'Delivery',
  tables: 'Table',
  table: 'Table',
  kiosk: 'Kiosk',
  dine_in: 'Dine in',
  'dine in': 'Dine in',
  online: 'Online',
};

const ES_MODES: Record<string, string> = {
  pos: 'TPV',
  takeaway: 'Para llevar',
  'take away': 'Para llevar',
  'take-away': 'Para llevar',
  delivery: 'Entrega',
  tables: 'Mesa',
  table: 'Mesa',
  kiosk: 'Kiosco',
  dine_in: 'Comer aquí',
  'dine in': 'Comer aquí',
  online: 'Online',
};

const EN_PAYMENTS: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  'card terminal': 'Card Terminal',
  card_terminal: 'Card Terminal',
  split: 'Split',
};

const ES_PAYMENTS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  'card terminal': 'Datáfono',
  card_terminal: 'Datáfono',
  split: 'Dividido',
};

function buildReceiptLabels(lang: UiLanguage): ReceiptLabels {
  const order = lang === 'es' ? ES_ORDER : EN_ORDER;
  const modes = lang === 'es' ? ES_MODES : EN_MODES;
  const payments = lang === 'es' ? ES_PAYMENTS : EN_PAYMENTS;

  if (lang === 'es') {
    return {
      ...order,
      orderTitle: order.documentTitle,
      kioskTitle: 'Recibo de kiosco',
      ticketLine: order.token,
      modes,
      payments,
      shiftStatuses: { open: 'Abierto', closed: 'Cerrado', ended: 'Finalizado' },
      shiftTitle: 'Registro de fin de turno',
      shiftDetails: 'Detalles del turno',
      started: 'Iniciado',
      openedBy: 'Abierto por',
      orders: 'Pedidos',
      shiftOrders: 'Pedidos del turno',
      ticketCol: 'Pedido',
      timeCol: 'Hora',
      payCol: 'Pago',
      noCompletedOrders: 'No hay pedidos completados.',
      totalSales: 'Ventas totales',
      cashReconciliation: 'Arqueo de caja',
      previousCashLeft: 'Efectivo anterior dejado',
      lastShiftEnded: 'Último turno finalizado',
      cashSales: 'Ventas en efectivo',
      cardOther: 'Tarjeta / otros',
      expectedInLocker: 'Esperado en caja',
      cashLeftInLocker: 'Efectivo dejado en caja',
      difference: 'Diferencia',
      differenceNote: 'Diferencia = efectivo dejado − esperado.',
      endOfShift: 'Fin del registro de turno',
      documentTitle: order.documentTitle,
    };
  }

  return {
    ...order,
    orderTitle: order.documentTitle,
    kioskTitle: 'Kiosk Ticket',
    ticketLine: order.token,
    modes,
    payments,
    shiftStatuses: { open: 'Open', closed: 'Closed', ended: 'Ended' },
    shiftTitle: 'Shift end record',
    shiftDetails: 'Shift details',
    started: 'Started',
    openedBy: 'Opened by',
    orders: 'Orders',
    shiftOrders: 'Shift orders',
    ticketCol: 'Ticket',
    timeCol: 'Time',
    payCol: 'Pay',
    noCompletedOrders: 'No completed orders.',
    totalSales: 'Total sales',
    cashReconciliation: 'Cash reconciliation',
    previousCashLeft: 'Previous cash left',
    lastShiftEnded: 'Last shift ended',
    cashSales: 'Cash sales',
    cardOther: 'Card / other',
    expectedInLocker: 'Expected in locker',
    cashLeftInLocker: 'Cash left in locker',
    difference: 'Difference',
    differenceNote: 'Difference = cash left − expected.',
    endOfShift: 'End of shift record',
    documentTitle: order.documentTitle,
  };
}

export function getReceiptLabels(lang?: string | null): ReceiptLabels {
  return buildReceiptLabels(resolveReceiptLang(lang));
}

export function getOrderReceiptLabels(lang?: string | null): OrderReceiptLabels {
  const all = getReceiptLabels(lang);
  return {
    documentTitle: all.kioskTitle || all.documentTitle,
    token: all.token,
    trackingId: all.trackingId,
    mode: all.mode,
    payment: all.payment,
    status: all.status,
    statusPaid: all.statusPaid,
    table: all.table,
    customer: all.customer,
    phone: all.phone,
    address: all.address,
    cutlery: all.cutlery,
    cutleryYes: all.cutleryYes,
    note: all.note,
    item: all.item,
    qty: all.qty,
    amt: all.amt,
    noItems: all.noItems,
    subtotal: all.subtotal,
    serviceCharge: all.serviceCharge,
    tax: all.tax,
    discount: all.discount,
    paid: all.paid,
    change: all.change,
    total: all.total,
    thankYou: all.thankYou,
    na: all.na,
  };
}

export function localizeReceiptMode(
  mode: string | null | undefined,
  labels: ReceiptLabels
): string {
  const raw = String(mode ?? '').trim();
  if (!raw) return labels.modes.pos;
  const key = raw.toLowerCase().replace(/_/g, ' ');
  return labels.modes[key] ?? labels.modes[raw.toLowerCase()] ?? raw;
}

export function localizeReceiptOrderMode(
  mode: string | null | undefined,
  lang?: string | null
): string {
  return localizeReceiptMode(mode, getReceiptLabels(lang));
}

export function localizeReceiptPayment(
  method: string | null | undefined,
  labels: ReceiptLabels
): string {
  const raw = String(method ?? '').trim();
  if (!raw) return labels.payments.cash;
  const key = raw.toLowerCase();
  if (labels.payments[key]) return labels.payments[key];
  if (key.includes('terminal')) return labels.payments['card terminal'];
  if (key === 'card' || key === 'tarjeta') return labels.payments.card;
  if (key === 'cash' || key === 'efectivo') return labels.payments.cash;
  if (key === 'split' || key === 'dividido') return labels.payments.split;
  return raw;
}

export function localizeReceiptPaymentMethod(
  method: string | null | undefined,
  lang?: string | null
): string {
  return localizeReceiptPayment(method, getReceiptLabels(lang));
}

export function localizeReceiptShiftStatus(
  status: string | null | undefined,
  labels: ReceiptLabels
): string {
  const key = String(status ?? '')
    .trim()
    .toLowerCase();
  return labels.shiftStatuses[key] ?? String(status ?? '—');
}
