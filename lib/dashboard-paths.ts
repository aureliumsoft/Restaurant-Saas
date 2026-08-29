import { urlSegment } from '@/lib/url-segment';

export function productEditPath(productId: string, urlId?: string | null): string {
  return `/product/edit/${encodeURIComponent(urlSegment(productId, urlId))}`;
}

export function ingredientEditPath(ingredientId: string, urlId?: string | null): string {
  return `/inventory/ingredients/${encodeURIComponent(urlSegment(ingredientId, urlId))}/edit`;
}

export function recordDetailPath(recordId: string, urlId?: string | null): string {
  return `/records/${encodeURIComponent(urlSegment(recordId, urlId))}`;
}

export function posOrderApiPath(
  orderId: string,
  suffix = '',
  urlId?: string | null
): string {
  const base = `/api/restaurant/pos-order/${encodeURIComponent(urlSegment(orderId, urlId))}`;
  return suffix ? `${base}/${suffix.replace(/^\//, '')}` : base;
}

export function kioskOrderApiPath(
  orderId: string,
  suffix = '',
  urlId?: string | null
): string {
  const base = `/api/restaurant/kiosk-order/${encodeURIComponent(urlSegment(orderId, urlId))}`;
  return suffix ? `${base}/${suffix.replace(/^\//, '')}` : base;
}

export function restaurantOrderApiPath(orderId: string, urlId?: string | null): string {
  return `/api/restaurant/orders/${encodeURIComponent(urlSegment(orderId, urlId))}`;
}

export function ingredientApiPath(
  ingredientId: string,
  suffix = '',
  urlId?: string | null
): string {
  const base = `/api/restaurant/inventory/ingredients/${encodeURIComponent(urlSegment(ingredientId, urlId))}`;
  return suffix ? `${base}/${suffix.replace(/^\//, '')}` : base;
}

export function menuItemApiPath(
  itemId: string,
  suffix = '',
  urlId?: string | null
): string {
  const base = `/api/restaurant/menu/items/${encodeURIComponent(urlSegment(itemId, urlId))}`;
  return suffix ? `${base}/${suffix.replace(/^\//, '')}` : base;
}

export function menuCategoryApiPath(
  categoryId: string,
  suffix = '',
  urlId?: string | null
): string {
  const base = `/api/restaurant/menu/categories/${encodeURIComponent(urlSegment(categoryId, urlId))}`;
  return suffix ? `${base}/${suffix.replace(/^\//, '')}` : base;
}

export function branchApiPath(
  branchId: string,
  suffix = '',
  urlId?: string | null
): string {
  const base = `/api/restaurant/branches/${encodeURIComponent(urlSegment(branchId, urlId))}`;
  return suffix ? `${base}/${suffix.replace(/^\//, '')}` : base;
}

export function tableApiPath(
  tableId: string,
  suffix = '',
  urlId?: string | null
): string {
  const base = `/api/restaurant/tables/${encodeURIComponent(urlSegment(tableId, urlId))}`;
  return suffix ? `${base}/${suffix.replace(/^\//, '')}` : base;
}

export function kdsTicketApiPath(
  ticketId: string,
  suffix = '',
  urlId?: string | null
): string {
  const base = `/api/restaurant/kds/tickets/${encodeURIComponent(urlSegment(ticketId, urlId))}`;
  return suffix ? `${base}/${suffix.replace(/^\//, '')}` : base;
}

export function kdsManagerOrderApiPath(
  orderId: string,
  suffix = '',
  urlId?: string | null
): string {
  const base = `/api/restaurant/kds/manager-orders/${encodeURIComponent(urlSegment(orderId, urlId))}`;
  return suffix ? `${base}/${suffix.replace(/^\//, '')}` : base;
}

export function variationApiPath(
  variationId: string,
  suffix = '',
  urlId?: string | null
): string {
  const base = `/api/restaurant/variations/${encodeURIComponent(urlSegment(variationId, urlId))}`;
  return suffix ? `${base}/${suffix.replace(/^\//, '')}` : base;
}

export function customerMenuItemApiPath(
  itemId: string,
  suffix = '',
  urlId?: string | null
): string {
  const base = `/api/customer/menu/items/${encodeURIComponent(urlSegment(itemId, urlId))}`;
  return suffix ? `${base}/${suffix.replace(/^\//, '')}` : base;
}

export function customerMenuCategoryApiPath(
  categoryId: string,
  suffix = '',
  urlId?: string | null
): string {
  const base = `/api/customer/menu/categories/${encodeURIComponent(urlSegment(categoryId, urlId))}`;
  return suffix ? `${base}/${suffix.replace(/^\//, '')}` : base;
}

export function transactionApiPath(id: string, suffix = '', urlId?: string | null): string {
  const base = `/api/transactions/${encodeURIComponent(urlSegment(id, urlId))}`;
  return suffix ? `${base}/${suffix.replace(/^\//, '')}` : base;
}

export function employeeApiPath(
  employeeId: string,
  suffix = '',
  urlId?: string | null
): string {
  const base = `/api/restaurant/employees/${encodeURIComponent(urlSegment(employeeId, urlId))}`;
  return suffix ? `${base}/${suffix.replace(/^\//, '')}` : base;
}

export function roleApiPath(roleId: string, suffix = '', urlId?: string | null): string {
  const base = `/api/restaurant/roles/${encodeURIComponent(urlSegment(roleId, urlId))}`;
  return suffix ? `${base}/${suffix.replace(/^\//, '')}` : base;
}

export function customerOrderApiPath(
  orderId: string,
  suffix = '',
  urlId?: string | null
): string {
  const base = `/api/customer/me/orders/${encodeURIComponent(urlSegment(orderId, urlId))}`;
  return suffix ? `${base}/${suffix.replace(/^\//, '')}` : base;
}
