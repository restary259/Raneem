import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mocks the minimal supabase surface used by CaseService.resolveAttribution:
 *   - rpc("resolve_profile_names", { p_ids })  → { data: [{id, full_name}], error }
 *   - from("user_roles").select(...).in("user_id", ids) → { data: [{user_id, role}], error }
 *
 * Both are awaited in parallel inside resolveAttribution, so each test seeds
 * `nameData` / `roleData` before the call and asserts on the merged map.
 */
type NameRow = { id: string; full_name: string | null };
type RoleRow = { user_id: string; role: string };

let nameData: NameRow[] = [];
let nameError: { message: string } | null = null;
let roleData: RoleRow[] = [];
let roleError: { message: string } | null = null;
let lastRpcArgs: Record<string, unknown> | null = null;
let lastInColumn: string | null = null;
let lastInValues: unknown[] | null = null;

function chain() {
  const result = {
    get data() {
      return roleData;
    },
    error: roleError as null,
  };
  const self = {
    data: result.data,
    error: result.error,
    select: () => self,
    in: (col: string, vals: unknown[]) => {
      lastInColumn = col;
      lastInValues = vals;
      return self;
    },
    then: (resolve: (v: typeof result) => void) => Promise.resolve(result).then(resolve),
  };
  return self;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (fn: string, args: Record<string, unknown>) => {
      if (fn === "resolve_profile_names") {
        lastRpcArgs = args;
        return Promise.resolve({ data: nameData, error: nameError });
      }
      return Promise.resolve({ data: null, error: { message: `unexpected rpc ${fn}` } });
    },
    from: (table: string) => {
      if (table === "user_roles") return chain();
      throw new Error(`unexpected from(${table})`);
    },
  },
}));

import { CaseService } from "./CaseService";

beforeEach(() => {
  nameData = [];
  nameError = null;
  roleData = [];
  roleError = null;
  lastRpcArgs = null;
  lastInColumn = null;
  lastInValues = null;
});

describe("CaseService.resolveAttribution", () => {
  it("returns {} for an empty / all-null id set without calling supabase", async () => {
    const out = await CaseService.resolveAttribution([null, undefined, ""]);
    expect(out).toEqual({});
    expect(lastRpcArgs).toBeNull();
    expect(lastInValues).toBeNull();
  });

  it("dedupes ids before querying", async () => {
    nameData = [{ id: "p1", full_name: "Sara" }];
    const out = await CaseService.resolveAttribution(["p1", "p1", null, "p1"]);
    expect(lastRpcArgs!.p_ids).toEqual(["p1"]);
    expect(lastInColumn).toBe("user_id");
    expect(lastInValues).toEqual(["p1"]);
    expect(Object.keys(out)).toEqual(["p1"]);
  });

  it("resolves a single partner: name + role", async () => {
    nameData = [{ id: "p1", full_name: "Sara Ali" }];
    roleData = [{ user_id: "p1", role: "social_media_partner" }];
    const out = await CaseService.resolveAttribution(["p1"]);
    expect(out["p1"]).toEqual({ name: "Sara Ali", role: "social_media_partner" });
  });

  it("resolves an agent (role 'agent')", async () => {
    nameData = [{ id: "a1", full_name: "Ahmed Darb" }];
    roleData = [{ user_id: "a1", role: "agent" }];
    const out = await CaseService.resolveAttribution(["a1"]);
    expect(out["a1"]).toEqual({ name: "Ahmed Darb", role: "agent" });
  });

  it("picks the highest-priority role when a user holds several (agent beats team_member)", async () => {
    nameData = [{ id: "u1", full_name: "Dual" }];
    roleData = [
      { user_id: "u1", role: "team_member" },
      { user_id: "u1", role: "agent" },
      { user_id: "u1", role: "admin" },
    ];
    const out = await CaseService.resolveAttribution(["u1"]);
    expect(out["u1"].role).toBe("agent");
  });

  it("agent beats social_media_partner (so an agent-recruited partner who is also an agent shows as agent)", async () => {
    nameData = [{ id: "u2", full_name: "Mix" }];
    roleData = [
      { user_id: "u2", role: "social_media_partner" },
      { user_id: "u2", role: "agent" },
    ];
    const out = await CaseService.resolveAttribution(["u2"]);
    expect(out["u2"].role).toBe("agent");
  });

  it("keeps the first non-priority role only when no priority role exists", async () => {
    nameData = [{ id: "u3", full_name: "Student X" }];
    roleData = [{ user_id: "u3", role: "student" }];
    const out = await CaseService.resolveAttribution(["u3"]);
    // student is not in ATTRIBUTION_ROLE_PRIORITY; falls back to the role itself.
    expect(out["u3"]).toEqual({ name: "Student X", role: "student" });
  });

  it("a deleted profile (absent from resolve_profile_names) with a lingering role row resolves to name '—'", async () => {
    // resolve_profile_names filters deleted_at IS NULL, so a deleted partner returns no row.
    nameData = [];
    roleData = [{ user_id: "gone", role: "social_media_partner" }];
    const out = await CaseService.resolveAttribution(["gone"]);
    expect(out["gone"]).toEqual({ name: "—", role: "social_media_partner" });
  });

  it("a profile with no role rows resolves to role null", async () => {
    nameData = [{ id: "p9", full_name: "No Role" }];
    roleData = [];
    const out = await CaseService.resolveAttribution(["p9"]);
    expect(out["p9"]).toEqual({ name: "No Role", role: null });
  });

  it("a null full_name in resolve_profile_names falls back to '—'", async () => {
    nameData = [{ id: "p7", full_name: null }];
    roleData = [{ user_id: "p7", role: "ambassador" }];
    const out = await CaseService.resolveAttribution(["p7"]);
    expect(out["p7"]).toEqual({ name: "—", role: "ambassador" });
  });

  it("throws when resolve_profile_names errors", async () => {
    nameError = { message: "rpc down" };
    await expect(CaseService.resolveAttribution(["p1"])).rejects.toEqual({ message: "rpc down" });
  });

  it("throws when the user_roles read errors", async () => {
    roleError = { message: "rls denied" };
    await expect(CaseService.resolveAttribution(["p1"])).rejects.toEqual({ message: "rls denied" });
  });
});
