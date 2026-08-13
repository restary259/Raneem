import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFormDraft } from "./useFormDraft";

const PREFIX = "darb:draft:";
const MIN = 60_000;
const TTL = 30 * MIN;

/**
 * Helpers use a controlled Date.now() via vi.setSystemTime so no real wall-clock
 * time elapses. Fake timers drive the debounced write + idle-timeout effects.
 */
function seedDraft(key: string, data: unknown, savedAt: number, version = 1) {
  localStorage.setItem(
    `${PREFIX}${key}`,
    JSON.stringify({ v: version, savedAt, data }),
  );
}

function readDraft<T = unknown>(key: string): { savedAt: number; data: T; v: number } | null {
  const raw = localStorage.getItem(`${PREFIX}${key}`);
  return raw ? (JSON.parse(raw) as { savedAt: number; data: T; v: number }) : null;
}

describe("useFormDraft", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("restores a fresh draft written moments ago", () => {
    seedDraft("k", { name: "A" }, Date.now());
    const { result } = renderHook(({ v }) => useFormDraft({ key: "k", value: v }), {
      initialProps: { v: { name: "B" } },
    });
    // mount effect runs
    expect(result.current.restoredDraft).toEqual({ name: "A" });
    expect(result.current.savedAt).toBe(Date.now());
    expect(result.current.expired).toBe(false);
  });

  it("restores a draft saved 10 minutes ago", () => {
    seedDraft("k", { name: "A" }, Date.now() - 10 * MIN);
    const { result } = renderHook(({ v }) => useFormDraft({ key: "k", value: v }), {
      initialProps: { v: { name: "B" } },
    });
    expect(result.current.restoredDraft).toEqual({ name: "A" });
    expect(result.current.expired).toBe(false);
  });

  it("restores a draft saved 29 minutes ago (just under TTL)", () => {
    seedDraft("k", { name: "A" }, Date.now() - 29 * MIN);
    const { result } = renderHook(({ v }) => useFormDraft({ key: "k", value: v }), {
      initialProps: { v: { name: "B" } },
    });
    expect(result.current.restoredDraft).toEqual({ name: "A" });
    expect(result.current.expired).toBe(false);
  });

  it("treats a draft 30 min + 1 s old as expired and removes it", () => {
    seedDraft("k", { name: "A" }, Date.now() - (30 * MIN + 1000));
    const { result } = renderHook(({ v }) => useFormDraft({ key: "k", value: v }), {
      initialProps: { v: { name: "B" } },
    });
    expect(result.current.restoredDraft).toBeNull();
    expect(result.current.expired).toBe(true);
    expect(localStorage.getItem(`${PREFIX}k`)).toBeNull();
  });

  it("does not restore a version-mismatched draft and removes it", () => {
    seedDraft("k", { name: "A" }, Date.now(), 99);
    const { result } = renderHook(({ v }) =>
      useFormDraft({ key: "k", version: 1, value: v }),
      { initialProps: { v: { name: "B" } } },
    );
    expect(result.current.restoredDraft).toBeNull();
    expect(localStorage.getItem(`${PREFIX}k`)).toBeNull();
  });

  it("a debounced write at minute 29 pushes savedAt forward (timer reset)", () => {
    // Draft saved 29 min ago — still valid.
    seedDraft("k", { name: "A" }, Date.now() - 29 * MIN);
    const { result, rerender } = renderHook(({ v }) => useFormDraft({ key: "k", value: v }), {
      initialProps: { v: { name: "A" } },
    });

    expect(result.current.savedAt).toBe(Date.now() - 29 * MIN);
    const oldExpiry = result.current.expiresAt;
    expect(oldExpiry).toBe(Date.now() - 29 * MIN + TTL);

    // Advance 1 minute (now 30 min after the original save — would be expired),
    // then edit the value to trigger a debounced write that resets savedAt.
    act(() => {
      vi.setSystemTime(new Date(Date.now() + MIN));
      rerender({ v: { name: "changed" } });
    });
    act(() => {
      vi.advanceTimersByTime(600); // debounceMs default
    });

    // savedAt now reflects the NEW write, so expiry moved forward to +TTL from now.
    const now = Date.now();
    expect(result.current.savedAt).toBe(now);
    expect(result.current.expiresAt).toBe(now + TTL);
    // The draft must still be alive (would have expired under the old savedAt).
    expect(localStorage.getItem(`${PREFIX}k`)).not.toBeNull();
  });

  it("actively expires a draft left idle while mounted (no refresh needed)", () => {
    // Fresh draft restored on mount.
    seedDraft("k", { name: "A" }, Date.now());
    const { result } = renderHook(({ v }) => useFormDraft({ key: "k", value: v }), {
      initialProps: { v: { name: "B" } },
    });
    expect(result.current.savedAt).not.toBeNull();

    // Sit idle for the full TTL (30 min). The active idle-timeout fires.
    act(() => {
      vi.setSystemTime(new Date(Date.now() + TTL + 1000));
      vi.advanceTimersByTime(TTL + 1000);
    });

    expect(result.current.savedAt).toBeNull();
    expect(result.current.expired).toBe(true);
    expect(localStorage.getItem(`${PREFIX}k`)).toBeNull();
  });

  it("clearDraft removes the key and resets state", () => {
    seedDraft("k", { name: "A" }, Date.now());
    const { result } = renderHook(({ v }) => useFormDraft({ key: "k", value: v }), {
      initialProps: { v: { name: "B" } },
    });
    expect(localStorage.getItem(`${PREFIX}k`)).not.toBeNull();

    act(() => result.current.clearDraft());

    expect(localStorage.getItem(`${PREFIX}k`)).toBeNull();
    expect(result.current.savedAt).toBeNull();
    expect(result.current.restoredDraft).toBeNull();
    expect(result.current.expired).toBe(false);
  });

  it("two different keys never mix", () => {
    seedDraft("a", { name: "alpha" }, Date.now());
    seedDraft("b", { name: "beta" }, Date.now());

    const { result: ra } = renderHook(({ v }) => useFormDraft({ key: "a", value: v }), {
      initialProps: { v: { name: "" } },
    });
    const { result: rb } = renderHook(({ v }) => useFormDraft({ key: "b", value: v }), {
      initialProps: { v: { name: "" } },
    });

    expect(ra.current.restoredDraft).toEqual({ name: "alpha" });
    expect(rb.current.restoredDraft).toEqual({ name: "beta" });

    // Clearing A must not touch B.
    act(() => ra.current.clearDraft());
    expect(localStorage.getItem(`${PREFIX}a`)).toBeNull();
    expect(readDraft("b")).not.toBeNull();
  });

  it("does not restore when disabled", () => {
    seedDraft("k", { name: "A" }, Date.now());
    const { result } = renderHook(({ v }) =>
      useFormDraft({ key: "k", value: v, enabled: false }),
      { initialProps: { v: { name: "B" } } },
    );
    expect(result.current.restoredDraft).toBeNull();
  });
});
