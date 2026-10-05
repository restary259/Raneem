import { useCallback, useMemo, useState, useEffect } from "react";

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

interface UsePaginationOptions {
  /**
   * Drive the current page from the caller (e.g. a URL search param) instead of
   * the hook's internal state. When set, the internal page is ignored and
   * `setPage` forwards the requested page to `onPageChange`.
   */
  page?: number;
  onPageChange?: (page: number) => void;
  /** Rows per page, for callers that also persist the page size. */
  pageSize?: number;
  onPageSizeChange?: (pageSize: number) => void;
}

/**
 * Client-side pagination for admin/staff tables.
 * Resets to page 1 whenever the underlying row count changes (e.g. filtering).
 *
 * Pass `page`/`onPageChange` to keep the current page in the URL so browser
 * Back returns to the exact page the user left.
 */
export function usePagination<T>(
  rows: T[],
  initialPageSize = 25,
  options: UsePaginationOptions = {},
): PaginationState<T> {
  const { page: controlledPage, onPageChange, pageSize: controlledPageSize, onPageSizeChange } = options;
  const isControlled = controlledPage !== undefined;
  const [internalPage, setInternalPage] = useState(1);
  const [internalPageSize, setInternalPageSize] = useState(initialPageSize);

  const page = isControlled ? controlledPage : internalPage;
  const pageSize = controlledPageSize ?? internalPageSize;

  const setPage = useCallback(
    (p: number) => {
      if (onPageChange) onPageChange(p);
      else setInternalPage(p);
    },
    [onPageChange],
  );

  const setPageSize = useCallback(
    (s: number) => {
      if (onPageSizeChange) onPageSizeChange(s);
      else setInternalPageSize(s);
      // A different page size re-slices the rows, so return to the first page.
      setPage(1);
    },
    [onPageSizeChange, setPage],
  );

  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    // In controlled mode the caller owns the page (and resets it itself when it
    // changes a filter), so the hook must never overwrite the URL-derived page.
    if (isControlled) return;
    setPage(1);
    // Reset on the underlying row count (filtering) and on page-size changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, pageSize, isControlled]);

  const safePage = Math.min(Math.max(1, page), pageCount);

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
    next: () => setPage(Math.min(safePage + 1, pageCount)),
    prev: () => setPage(Math.max(safePage - 1, 1)),
  };
}
