/* eslint-disable @typescript-eslint/no-explicit-any -- loose types for untyped mock surfaces (supabase query builders, browser globals) */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Op = { op: string; args: unknown[] };
type State = { table: string; ops: Op[] };
type Result = { data: unknown; error: { message: string } | null };

let states: State[] = [];
let results: Record<string, Result> = {};

function from(table: string) {
  const state: State = { table, ops: [] };
  states.push(state);
  const result = results[table] ?? { data: null, error: null };
  const chain: any = {
    select: (...args: unknown[]) => (
      state.ops.push({ op: "select", args }),
      chain
    ),
    insert: (...args: unknown[]) => {
      state.ops.push({ op: "insert", args });
      return Promise.resolve(result);
    },
    eq: (...args: unknown[]) => (state.ops.push({ op: "eq", args }), chain),
    order: (...args: unknown[]) => (
      state.ops.push({ op: "order", args }),
      chain
    ),
    then: (resolve: (v: Result) => void) =>
      Promise.resolve(result).then(resolve),
  };
  return chain;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => from(table) },
}));

import { PaymentService } from "./PaymentService";

beforeEach(() => {
  states = [];
  results = {};
});

describe("PaymentService", () => {
  it("lists a student's payments newest-first", async () => {
    results.payments = { data: [{ id: "pay1" }], error: null };
    await expect(PaymentService.listByStudent("s1")).resolves.toEqual([
      { id: "pay1" },
    ]);
    expect(states[0].table).toBe("payments");
    expect(states[0].ops).toContainEqual({
      op: "eq",
      args: ["student_id", "s1"],
    });
    expect(states[0].ops).toContainEqual({
      op: "order",
      args: ["created_at", { ascending: false }],
    });
  });

  it("records a payment by inserting the payload", async () => {
    await PaymentService.record({ student_id: "s1", amount: 100 });
    expect(states[0].ops[0]).toEqual({
      op: "insert",
      args: [{ student_id: "s1", amount: 100 }],
    });
  });

  it("throws when recording fails", async () => {
    results.payments = { data: null, error: { message: "constraint" } };
    await expect(PaymentService.record({})).rejects.toEqual({
      message: "constraint",
    });
  });

  it("lists payout requests newest-first", async () => {
    results.payout_requests = { data: [{ id: "pr1" }], error: null };
    await expect(PaymentService.listPayoutRequests()).resolves.toEqual([
      { id: "pr1" },
    ]);
    expect(states[0].ops).toContainEqual({
      op: "order",
      args: ["requested_at", { ascending: false }],
    });
  });
});
