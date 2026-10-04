import { describe, it, expect } from "vitest";
import { listScopedStudents, resolveCreatedBy } from "./teamStudentsScope";

type Call = { table: string; ops: [string, ...any[]][] };

function mockClient(results: Record<string, any[]>, failOn?: string) {
  const calls: Call[] = [];
  const counters: Record<string, number> = {};
  return {
    calls,
    from(table: string) {
      const call: Call = { table, ops: [] };
      calls.push(call);
      const builder: any = {};
      for (const m of ["select", "eq", "in", "is", "not", "order"]) {
        builder[m] = (...args: any[]) => { call.ops.push([m, ...args]); return builder; };
      }
      builder.then = (res: any, rej: any) => {
        const n = (counters[table] = (counters[table] ?? 0) + 1);
        const key = `${table}#${n}`;
        if (failOn === key) return Promise.resolve({ data: null, error: new Error("boom") }).then(res, rej);
        return Promise.resolve({ data: results[key] ?? results[table] ?? [], error: null }).then(res, rej);
      };
      return builder;
    },
  };
}

const p = (id: string, created_at = "2026-01-01") => ({ id, full_name: id, email: `${id}@x`, created_at });

describe("listScopedStudents", () => {
  it("team member: scopes explicitly to created_by = me and assigned cases", async () => {
    const c = mockClient({
      user_roles: [{ user_id: "s1" }, { user_id: "s2" }, { user_id: "s3" }],
      "profiles#1": [p("s1")],
      cases: [{ student_user_id: "s2" }, { student_user_id: "s1" }],
      "profiles#2": [p("s2", "2026-02-01")],
    });
    const out = await listScopedStudents({ userId: "me", isAdmin: false }, c);
    expect(out.map((s) => s.id)).toEqual(["s2", "s1"]);
    const created = c.calls.filter((x) => x.table === "profiles")[0];
    expect(created.ops).toContainEqual(["eq", "created_by", "me"]);
    const cases = c.calls.find((x) => x.table === "cases")!;
    expect(cases.ops).toContainEqual(["eq", "assigned_to", "me"]);
    // never an unscoped profiles list for team members
    const assignedQ = c.calls.filter((x) => x.table === "profiles")[1];
    expect(assignedQ.ops).toContainEqual(["in", "id", ["s2"]]);
  });

  it("team member: drops non-student rows even if visible", async () => {
    const c = mockClient({ user_roles: [{ user_id: "s1" }], "profiles#1": [p("s1"), p("staff")], cases: [] });
    const out = await listScopedStudents({ userId: "me", isAdmin: false }, c);
    expect(out.map((s) => s.id)).toEqual(["s1"]);
  });

  it("admin: returns every student without created_by filter", async () => {
    const c = mockClient({ user_roles: [{ user_id: "a" }, { user_id: "b" }], profiles: [p("a"), p("b")] });
    const out = await listScopedStudents({ userId: "admin", isAdmin: true }, c);
    expect(out).toHaveLength(2);
    const q = c.calls.find((x) => x.table === "profiles")!;
    expect(q.ops.some((o) => o[1] === "created_by")).toBe(false);
    expect(c.calls.some((x) => x.table === "cases")).toBe(false);
  });

  it("throws on read failure instead of returning []", async () => {
    const c = mockClient({ user_roles: [{ user_id: "s1" }] }, "cases#1");
    await expect(listScopedStudents({ userId: "me", isAdmin: false }, c)).rejects.toThrow("boom");
  });
});

describe("resolveCreatedBy", () => {
  it("ignores a team member's override", () => {
    expect(resolveCreatedBy(false, "me", "other")).toBe("me");
  });
  it("keeps an admin's override, defaults to caller", () => {
    expect(resolveCreatedBy(true, "admin", "kheir")).toBe("kheir");
    expect(resolveCreatedBy(true, "admin", null)).toBe("admin");
  });
});
