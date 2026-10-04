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
    update: (...args: unknown[]) => (
      state.ops.push({ op: "update", args }),
      chain
    ),
    eq: (...args: unknown[]) => (state.ops.push({ op: "eq", args }), chain),
    in: (...args: unknown[]) => (state.ops.push({ op: "in", args }), chain),
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

import { PartnerService } from "./PartnerService";

beforeEach(() => {
  states = [];
  results = {};
});

describe("PartnerService.listLinks", () => {
  it("queries the partner's links oldest-first", async () => {
    results.partner_links = { data: [{ id: "l1" }], error: null };
    await expect(PartnerService.listLinks("p1")).resolves.toEqual([
      { id: "l1" },
    ]);
    expect(states[0].ops).toContainEqual({
      op: "eq",
      args: ["partner_id", "p1"],
    });
    expect(states[0].ops).toContainEqual({
      op: "order",
      args: ["created_at", { ascending: true }],
    });
  });

  it("returns [] when the result is null", async () => {
    results.partner_links = { data: null, error: null };
    await expect(PartnerService.listLinks("p1")).resolves.toEqual([]);
  });
});

describe("PartnerService.createLink", () => {
  it("inserts the link with the default /apply target", async () => {
    await PartnerService.createLink("p1", "CODE1", "My link");
    expect(states[0].ops[0]).toEqual({
      op: "insert",
      args: [
        {
          partner_id: "p1",
          code: "CODE1",
          label: "My link",
          target_path: "/apply",
        },
      ],
    });
  });

  it("honours an explicit target path", async () => {
    await PartnerService.createLink("p1", "CODE2", "Signup", "/signup");
    expect(states[0].ops[0].args[0]).toMatchObject({ target_path: "/signup" });
  });
});

describe("PartnerService.setLinkActive", () => {
  it("updates the active flag for the link", async () => {
    await PartnerService.setLinkActive("l1", false);
    expect(states[0].ops).toEqual([
      { op: "update", args: [{ active: false }] },
      { op: "eq", args: ["id", "l1"] },
    ]);
  });
});

describe("PartnerService.clickCounts", () => {
  it("returns {} without querying when no link ids are given", async () => {
    await expect(PartnerService.clickCounts([])).resolves.toEqual({});
    expect(states).toHaveLength(0);
  });

  it("tallies clicks by partner_link_id", async () => {
    results.partner_clicks = {
      data: [
        { partner_link_id: "l1" },
        { partner_link_id: "l1" },
        { partner_link_id: "l2" },
      ],
      error: null,
    };
    await expect(PartnerService.clickCounts(["l1", "l2"])).resolves.toEqual({
      l1: 2,
      l2: 1,
    });
    expect(states[0].ops).toContainEqual({
      op: "in",
      args: ["partner_link_id", ["l1", "l2"]],
    });
  });

  it("throws the query error", async () => {
    results.partner_clicks = { data: null, error: { message: "denied" } };
    await expect(PartnerService.clickCounts(["l1"])).rejects.toEqual({
      message: "denied",
    });
  });
});

describe("PartnerService.listRewards", () => {
  it("queries rewards for the partner newest-first", async () => {
    results.rewards = { data: [{ id: "r1" }], error: null };
    await expect(PartnerService.listRewards("p1")).resolves.toEqual([
      { id: "r1" },
    ]);
    expect(states[0].ops).toContainEqual({ op: "eq", args: ["user_id", "p1"] });
    expect(states[0].ops).toContainEqual({
      op: "order",
      args: ["created_at", { ascending: false }],
    });
  });
});
