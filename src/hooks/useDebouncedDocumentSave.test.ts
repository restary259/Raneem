import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { DocBlock } from "@/lib/documentBlocks";

const updateMock = vi.fn();
const libUpdateMock = vi.fn();
const getSession = vi.fn();
/** When true, the document_versions update rejects with a fixed message. */
let versionsShouldFail = false;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      update: (patch: Record<string, unknown>) => ({
        eq: (_col: string, _val: string) => {
          if (table === "document_versions") {
            updateMock(patch);
            return Promise.resolve(
              versionsShouldFail ? { error: { message: "write failed" } } : { error: null },
            );
          }
          libUpdateMock(patch);
          return Promise.resolve({ error: null });
        },
      }),
    }),
    auth: { getSession: () => getSession() },
  },
}));

// Import after the mock is registered.
const { useDebouncedDocumentSave } = await import("@/hooks/useDebouncedDocumentSave");

const DELAY = 500;

/**
 * Drives the debounced Supabase autosave hook with fake timers (the same
 * pattern as useFormDraft.test.ts). Verifies: clean mount is not dirty,
 * an edit marks dirty + queues a 500ms write, the write fires and clears
 * dirty, and `flush()` fires immediately.
 */
describe("useDebouncedDocumentSave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    updateMock.mockClear();
    libUpdateMock.mockClear();
    getSession.mockReset();
    getSession.mockResolvedValue({ data: { session: { user: { id: "u1" } } } });
    versionsShouldFail = false;
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const render = (blocks: DocBlock[], versionId = "v1", documentId = "d1", title = "Doc") =>
    renderHook(
      ({ b, t }) =>
        useDebouncedDocumentSave(b, {
          documentId,
          versionId,
          version: "1.0",
          title: t,
          delayMs: DELAY,
        }),
      { initialProps: { b: blocks, t: title } },
    );

  it("marks dirty after an edit and clears dirty once the debounced write lands", async () => {
    const a = { id: "b1", type: "paragraph", text: "hello" } as DocBlock;
    const { result, rerender } = render([a]);
    // Initial mount adopts the snapshot as the baseline → not dirty.
    expect(result.current.dirty).toBe(false);

    const next = [{ ...a, text: "changed" }] as DocBlock;
    await act(async () => {
      rerender({ b: next, t: "Doc" });
    });
    expect(result.current.dirty).toBe(true);
    expect(updateMock).not.toHaveBeenCalled();

    // Fire the debounce.
    await act(async () => {
      vi.advanceTimersByTime(DELAY);
      await vi.runAllTicks();
    });
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(result.current.dirty).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("flush() fires immediately without waiting for the debounce", async () => {
    const a = { id: "b1", type: "paragraph", text: "x" } as DocBlock;
    const { result, rerender } = render([a]);
    expect(result.current.dirty).toBe(false);

    const next = [{ ...a, text: "y" }] as DocBlock;
    await act(async () => {
      rerender({ b: next, t: "Doc" });
    });
    expect(result.current.dirty).toBe(true);

    await act(async () => {
      await result.current.flush();
    });
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(result.current.dirty).toBe(false);
  });

  it("does not mark dirty when the blocks are identical to the baseline", async () => {
    const a = { id: "b1", type: "paragraph", text: "same" } as DocBlock;
    const { result, rerender } = render([a]);
    await act(async () => {
      rerender({ b: [{ ...a }], t: "Doc" });
    });
    expect(result.current.dirty).toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("surfaces an error when the write fails", async () => {
    versionsShouldFail = true;
    const a = { id: "b1", type: "paragraph", text: "z" } as DocBlock;
    const { result, rerender } = render([a]);
    const next = [{ ...a, text: "changed2" }] as DocBlock;
    await act(async () => {
      rerender({ b: next, t: "Doc" });
    });
    await act(async () => {
      vi.advanceTimersByTime(DELAY);
    });
    // Flush all queued microtasks (the persist chain is multi-await).
    await act(async () => {
      await vi.runAllTicks();
    });
    expect(result.current.error).toBe("write failed");
    expect(result.current.saving).toBe(false);
  });
});
