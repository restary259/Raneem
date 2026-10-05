import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePagination } from "./usePagination";

const rows = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe("usePagination", () => {
  it("paginates internally and resets to page 1 when the rows change", () => {
    const { result, rerender } = renderHook(
      ({ data }) => usePagination(data, 10),
      {
        initialProps: { data: rows(30) },
      },
    );

    expect(result.current.page).toBe(1);
    expect(result.current.pageCount).toBe(3);
    expect(result.current.items).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);
    expect(result.current.items).toEqual([
      21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
    ]);

    // A filter change shrinks the list and must return to page 1.
    rerender({ data: rows(5) });
    expect(result.current.page).toBe(1);
  });

  it("honours a controlled page and forwards changes without resetting", () => {
    const onPageChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ data, page }) => usePagination(data, 10, { page, onPageChange }),
      { initialProps: { data: rows(30), page: 2 } },
    );

    expect(result.current.page).toBe(2);
    expect(result.current.items[0]).toBe(11);

    act(() => result.current.setPage(3));
    expect(onPageChange).toHaveBeenCalledWith(3);
    // The caller (the URL) owns the page; the hook does not move on its own.
    expect(result.current.page).toBe(2);

    // Even when the row count changes, the controlled page is preserved.
    rerender({ data: rows(30), page: 3 });
    expect(result.current.page).toBe(3);

    rerender({ data: rows(12), page: 3 });
    expect(result.current.page).toBe(2); // clamped to the new pageCount
  });
});
