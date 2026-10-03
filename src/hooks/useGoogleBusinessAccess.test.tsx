import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGoogleBusinessAccess } from "./useGoogleBusinessAccess";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "tm-1" }, initialized: true }),
}));

let rpcResult: { data: boolean | null; error: unknown };
const rpcCalls: string[] = [];
vi.mock("@/lib/googleBusinessApi", () => ({
  hasGoogleBusinessAccess: () => {
    rpcCalls.push("has_google_business_access");
    return Promise.resolve(rpcResult);
  },
}));

let realtimeListener: (() => void) | null = null;
let realtimeTables: string[] = [];
const unsubscribe = vi.fn();
vi.mock("@/lib/realtimeRegistry", () => ({
  subscribeTables: (_topic: string, tables: string[], listener: () => void) => {
    realtimeTables = tables;
    realtimeListener = listener;
    return unsubscribe;
  },
}));

describe("useGoogleBusinessAccess", () => {
  beforeEach(() => {
    rpcCalls.length = 0;
    realtimeListener = null;
    realtimeTables = [];
    unsubscribe.mockClear();
    rpcResult = { data: true, error: null };
  });

  it("stays unresolved until the server answers, then reports true", async () => {
    const { result } = renderHook(() => useGoogleBusinessAccess());
    expect(result.current).toBeNull();

    await waitFor(() => expect(result.current).toBe(true));
    expect(rpcCalls).toHaveLength(1);
  });

  it("reports false when the server denies access", async () => {
    rpcResult = { data: false, error: null };
    const { result } = renderHook(() => useGoogleBusinessAccess());
    await waitFor(() => expect(result.current).toBe(false));
  });

  it("hides the surface when the lookup fails", async () => {
    rpcResult = { data: null, error: { message: "boom" } };
    const { result } = renderHook(() => useGoogleBusinessAccess());
    await waitFor(() => expect(result.current).toBe(false));
  });

  it("does not call the server when inactive", async () => {
    const { result } = renderHook(() => useGoogleBusinessAccess(false));
    await waitFor(() => expect(result.current).toBe(false));
    expect(rpcCalls).toHaveLength(0);
  });

  it("re-reads access on a realtime operator change", async () => {
    const { result } = renderHook(() => useGoogleBusinessAccess());
    await waitFor(() => expect(result.current).toBe(true));

    rpcResult = { data: false, error: null };
    realtimeListener?.();
    await waitFor(() => expect(result.current).toBe(false));
    expect(rpcCalls).toHaveLength(2);
  });

  it("subscribes to operator, office-membership and profile changes", async () => {
    renderHook(() => useGoogleBusinessAccess());
    await waitFor(() => expect(realtimeListener).not.toBeNull());
    expect(realtimeTables).toEqual([
      "office_google_operators",
      "office_members",
      "profiles",
    ]);
  });

  it("revalidates when the tab regains focus", async () => {
    const { result } = renderHook(() => useGoogleBusinessAccess());
    await waitFor(() => expect(result.current).toBe(true));

    rpcResult = { data: false, error: null };
    window.dispatchEvent(new Event("focus"));
    await waitFor(() => expect(result.current).toBe(false));
    expect(rpcCalls).toHaveLength(2);
  });

  it("unsubscribes from realtime on unmount", async () => {
    const { unmount } = renderHook(() => useGoogleBusinessAccess());
    await waitFor(() => expect(realtimeListener).not.toBeNull());
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
