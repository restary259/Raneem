import { useMemo, useState, useEffect } from "react";

export interface PaginationState<T> {
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
  from: number;
  to: number;
  items: T[];
  setPage: (p: number) => void;
  setPageSize: (s: number) => void;
  canPrev: boolean;
  canNext: boolean;
  next: () => void;
  prev: () => void;
}

/**
 * Client-side pagination for admin/staff tables.
 * Resets to page 1 whenever the underlying row count changes (e.g. filtering).
 */
export function usePagination<T>(rows: T[], initialPageSize = 25): PaginationState<T> {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    setPage(1);
  }, [total, pageSize]);

  const safePage = Math.min(page, pageCount);

  const items = useMemo(
    () => rows.slice((safePage - 1) * pageSize, safePage * pageSize),
    [rows, safePage, pageSize],
  );

  return {
    page: safePage,
    pageSize,
    pageCount,
    total,
    from: total === 0 ? 0 : (safePage - 1) * pageSize + 1,
    to: Math.min(safePage * pageSize, total),
    items,
    setPage,
    setPageSize,
    canPrev: safePage > 1,
    canNext: safePage < pageCount,
    next: () => setPage((p) => Math.min(p + 1, pageCount)),
    prev: () => setPage((p) => Math.max(p - 1, 1)),
  };
}
