export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type ParsedPagination = {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
};

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function toPositiveInt(raw: string | null | undefined, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

/**
 * Parse `page` / `limit` (or `take`) query params into clamped pagination values.
 */
export function parsePaginationParams(
  searchParams: URLSearchParams | { get: (key: string) => string | null },
  opts?: {
    defaultPageSize?: number;
    maxPageSize?: number;
    /** Prefer `limit`; falls back to `take` for older clients. */
    pageSizeKeys?: string[];
  }
): ParsedPagination {
  const defaultPageSize = opts?.defaultPageSize ?? DEFAULT_PAGE_SIZE;
  const maxPageSize = opts?.maxPageSize ?? MAX_PAGE_SIZE;
  const keys = opts?.pageSizeKeys ?? ['limit', 'take'];

  const page = toPositiveInt(searchParams.get('page'), DEFAULT_PAGE);
  let pageSize = defaultPageSize;
  for (const key of keys) {
    const raw = searchParams.get(key);
    if (raw != null && raw !== '') {
      pageSize = Math.min(toPositiveInt(raw, defaultPageSize), maxPageSize);
      break;
    }
  }

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

export function buildPaginationMeta(
  page: number,
  pageSize: number,
  total: number
): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  return {
    page: safePage,
    pageSize,
    total: Math.max(0, total),
    totalPages,
    hasNextPage: safePage < totalPages,
    hasPrevPage: safePage > 1,
  };
}

/** Clamp page when total shrinks (e.g. after a filter change). */
export function clampPage(page: number, total: number, pageSize: number): number {
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / pageSize) || 1);
  return Math.min(Math.max(1, page), totalPages);
}
