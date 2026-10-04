import { beforeEach, describe, expect, it, vi } from "vitest";

let rpcResult: { data: unknown; error: { message: string } | null } = {
  data: null,
  error: null,
};
let rpcCalls: Array<{ fn: string; args?: Record<string, unknown> }> = [];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rest: {},
    rpc: function (this: unknown, fn: string, args?: Record<string, unknown>) {
      // `officeApi` binds `supabase` as `this`; fail loudly if it ever detaches.
      if (this === undefined || this === null)
        throw new Error("rpc called unbound");
      rpcCalls.push({ fn, args });
      return Promise.resolve(rpcResult);
    },
  },
}));

import {
  getOfficeWorkspace,
  listMyOffices,
  resolveOfficeSlug,
} from "./officeApi";

beforeEach(() => {
  rpcCalls = [];
  rpcResult = { data: null, error: null };
});

describe("officeApi", () => {
  it("resolveOfficeSlug calls resolve_office_slug with the slug", async () => {
    rpcResult = { data: "office-1", error: null };
    await expect(resolveOfficeSlug("berlin")).resolves.toEqual({
      data: "office-1",
      error: null,
    });
    expect(rpcCalls[0]).toEqual({
      fn: "resolve_office_slug",
      args: { p_slug: "berlin" },
    });
  });

  it("getOfficeWorkspace calls get_office_workspace with the id", async () => {
    rpcResult = { data: { office: { id: "o1" } }, error: null };
    await expect(getOfficeWorkspace("o1")).resolves.toEqual({
      data: { office: { id: "o1" } },
      error: null,
    });
    expect(rpcCalls[0]).toEqual({
      fn: "get_office_workspace",
      args: { p_office_id: "o1" },
    });
  });

  it("listMyOffices calls list_my_offices with no args", async () => {
    rpcResult = { data: [], error: null };
    await expect(listMyOffices()).resolves.toEqual({ data: [], error: null });
    expect(rpcCalls[0].fn).toBe("list_my_offices");
    expect(rpcCalls[0].args).toBeUndefined();
  });

  it("surfaces the RPC error instead of swallowing it", async () => {
    rpcResult = { data: null, error: { message: "Forbidden" } };
    await expect(getOfficeWorkspace("o1")).resolves.toEqual({
      data: null,
      error: { message: "Forbidden" },
    });
  });
});
