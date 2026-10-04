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
    update: (...args: unknown[]) => (
      state.ops.push({ op: "update", args }),
      chain
    ),
    eq: (...args: unknown[]) => (state.ops.push({ op: "eq", args }), chain),
    is: (...args: unknown[]) => (state.ops.push({ op: "is", args }), chain),
    order: (...args: unknown[]) => (
      state.ops.push({ op: "order", args }),
      chain
    ),
    maybeSingle: () => Promise.resolve(result),
    then: (resolve: (v: Result) => void) =>
      Promise.resolve(result).then(resolve),
  };
  return chain;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => from(table) },
}));

import { StudentService } from "./StudentService";

beforeEach(() => {
  states = [];
  results = {};
});

describe("StudentService.getProfile", () => {
  it("returns the profile row", async () => {
    results.profiles = { data: { id: "u1", full_name: "Layla" }, error: null };
    await expect(StudentService.getProfile("u1")).resolves.toEqual({
      id: "u1",
      full_name: "Layla",
    });
    expect(states[0].ops).toContainEqual({ op: "eq", args: ["id", "u1"] });
  });

  it("returns null when there is no row", async () => {
    results.profiles = { data: null, error: null };
    await expect(StudentService.getProfile("u1")).resolves.toBeNull();
  });
});

describe("StudentService.updateProfile", () => {
  it("strips must_change_password from the patch", async () => {
    await StudentService.updateProfile("u1", {
      city: "Haifa",
      must_change_password: true,
    });
    const update = states[0].ops.find((o) => o.op === "update");
    expect(update?.args[0]).toEqual({ city: "Haifa" });
    expect(states[0].ops).toContainEqual({ op: "eq", args: ["id", "u1"] });
  });
});

describe("StudentService.listDocuments", () => {
  it("excludes soft-deleted documents and orders newest-first", async () => {
    results.documents = { data: [{ id: "d1" }], error: null };
    await expect(StudentService.listDocuments("c1")).resolves.toEqual([
      { id: "d1" },
    ]);
    expect(states[0].ops).toContainEqual({ op: "eq", args: ["case_id", "c1"] });
    expect(states[0].ops).toContainEqual({
      op: "is",
      args: ["deleted_at", null],
    });
    expect(states[0].ops).toContainEqual({
      op: "order",
      args: ["created_at", { ascending: false }],
    });
  });

  it("returns [] when data is null", async () => {
    results.documents = { data: null, error: null };
    await expect(StudentService.listDocuments("c1")).resolves.toEqual([]);
  });
});

describe("StudentService.listChecklist", () => {
  it("joins checklist_items and filters by student", async () => {
    results.student_checklist = { data: [{ id: "chk1" }], error: null };
    await expect(StudentService.listChecklist("s1")).resolves.toEqual([
      { id: "chk1" },
    ]);
    expect(states[0].ops[0]).toEqual({
      op: "select",
      args: ["*, checklist_items(*)"],
    });
    expect(states[0].ops).toContainEqual({
      op: "eq",
      args: ["student_id", "s1"],
    });
  });

  it("throws the query error", async () => {
    results.student_checklist = { data: null, error: { message: "denied" } };
    await expect(StudentService.listChecklist("s1")).rejects.toEqual({
      message: "denied",
    });
  });
});
