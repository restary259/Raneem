import { describe, it, expect, vi, beforeEach } from "vitest";

interface UpdateCall {
  table: string;
  updates: Record<string, unknown>;
  filters: [string, unknown][];
}

const updateCalls: UpdateCall[] = [];
let updateResult: { data: Record<string, unknown> | null; error: { message: string } | null } = {
  data: { id: "c1" },
  error: null,
};
let updateThrows = false;

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      update: (updates: Record<string, unknown>) => {
        const call: UpdateCall = { table, updates, filters: [] };
        updateCalls.push(call);
        const builder = {
          eq: (column: string, value: unknown) => {
            call.filters.push([column, value]);
            return builder;
          },
          select: () => builder,
          maybeSingle: () => {
            if (updateThrows) return Promise.reject(new Error("socket closed"));
            return Promise.resolve(updateResult);
          },
        };
        return builder;
      },
    }),
  },
}));

import {
  atomicUpdate,
  claimIdempotencyKey,
  generateIdempotencyKey,
  guardedAction,
  lockAction,
  unlockAction,
} from "./conflictPrevention";

beforeEach(() => {
  window.localStorage.clear();
  updateCalls.length = 0;
  updateResult = { data: { id: "c1" }, error: null };
  updateThrows = false;
});

describe("generateIdempotencyKey", () => {
  it("namespaces the key by action and target and never repeats", () => {
    const key = generateIdempotencyKey("confirm_payment", "case-1");
    expect(key.startsWith("confirm_payment:case-1:")).toBe(true);
    expect(generateIdempotencyKey("confirm_payment", "case-1")).not.toBe(key);
  });
});

describe("claimIdempotencyKey", () => {
  it("claims a key once and refuses the replay", () => {
    expect(claimIdempotencyKey("pay:c1:1")).toBe(true);
    expect(claimIdempotencyKey("pay:c1:1")).toBe(false);
  });

  it("keeps distinct keys independent", () => {
    expect(claimIdempotencyKey("pay:c1:1")).toBe(true);
    expect(claimIdempotencyKey("pay:c1:2")).toBe(true);
  });

  it("forgets the oldest keys once the store is full", () => {
    for (let i = 0; i < 200; i++) claimIdempotencyKey(`pay:c${i}`);
    expect(claimIdempotencyKey("pay:c200")).toBe(true);
    // The first key was evicted, so an old replay is allowed through again.
    expect(claimIdempotencyKey("pay:c0")).toBe(true);
    expect(claimIdempotencyKey("pay:c200")).toBe(false);
  });

  it("allows the action when storage is unreadable", () => {
    window.localStorage.setItem("darb_idempotency_keys", "not json");
    expect(claimIdempotencyKey("pay:c1")).toBe(true);
  });
});

describe("atomicUpdate", () => {
  it("filters on the expected updated_at and refreshes it", async () => {
    const result = await atomicUpdate({
      table: "cases",
      id: "c1",
      updates: { status: "contacted" },
      expectedUpdatedAt: "2026-01-01T00:00:00Z",
    });

    expect(result).toEqual({ success: true, conflict: false, data: { id: "c1" } });
    expect(updateCalls[0].table).toBe("cases");
    expect(updateCalls[0].filters).toEqual([
      ["id", "c1"],
      ["updated_at", "2026-01-01T00:00:00Z"],
    ]);
    expect(updateCalls[0].updates.status).toBe("contacted");
    expect(updateCalls[0].updates.updated_at).not.toBe("2026-01-01T00:00:00Z");
  });

  it("reports a conflict when no row matched", async () => {
    updateResult = { data: null, error: null };
    const result = await atomicUpdate({
      table: "cases",
      id: "c1",
      updates: {},
      expectedUpdatedAt: "stale",
    });
    expect(result.success).toBe(false);
    expect(result.conflict).toBe(true);
    expect(result.error).toMatch(/modified by another session/);
  });

  it("surfaces a database error without calling it a conflict", async () => {
    updateResult = { data: null, error: { message: "permission denied" } };
    const result = await atomicUpdate({ table: "cases", id: "c1", updates: {}, expectedUpdatedAt: "x" });
    expect(result).toEqual({ success: false, conflict: false, error: "permission denied" });
  });

  it("catches transport failures", async () => {
    updateThrows = true;
    const result = await atomicUpdate({ table: "cases", id: "c1", updates: {}, expectedUpdatedAt: "x" });
    expect(result).toEqual({ success: false, conflict: false, error: "socket closed" });
  });
});

describe("lockAction", () => {
  it("locks an action key until it is released", () => {
    expect(lockAction("save:c1")).toBe(true);
    expect(lockAction("save:c1")).toBe(false);
    unlockAction("save:c1");
    expect(lockAction("save:c1")).toBe(true);
    unlockAction("save:c1");
  });
});

describe("guardedAction", () => {
  it("ignores a concurrent call and releases the lock afterwards", async () => {
    let resolveFirst: (v: string) => void = () => {};
    const first = guardedAction("save:c1", () => new Promise<string>((r) => { resolveFirst = r; }));

    expect(await guardedAction("save:c1", async () => "second")).toBeNull();

    resolveFirst("first");
    expect(await first).toBe("first");
    expect(await guardedAction("save:c1", async () => "third")).toBe("third");
  });

  it("releases the lock when the action throws", async () => {
    await expect(guardedAction("save:c1", async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    expect(await guardedAction("save:c1", async () => "next")).toBe("next");
  });
});
