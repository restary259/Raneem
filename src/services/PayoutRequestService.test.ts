import { beforeEach, describe, expect, it, vi } from "vitest";

let rpcResult: { data: unknown; error: { message: string } | null } = {
  data: null,
  error: null,
};
let rpcCalls: Array<{ fn: string; args?: Record<string, unknown> }> = [];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (fn: string, args?: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      return Promise.resolve(rpcResult);
    },
  },
}));

import {
  adminRespondPayoutRequest,
  getMyPayoutPreview,
  getPayoutRequestDetail,
  requestPayoutViaChat,
} from "./PayoutRequestService";

beforeEach(() => {
  rpcCalls = [];
  rpcResult = { data: null, error: null };
});

describe("getMyPayoutPreview", () => {
  it("coerces every numeric field and defaults to an empty case list", async () => {
    rpcResult = {
      data: {
        eligible_amount: "150.5",
        eligible_count: "2",
        locked_amount: 40,
        locked_count: 1,
        next_unlock_at: "2026-02-01T00:00:00Z",
        has_open_request: 1,
      },
      error: null,
    };
    await expect(getMyPayoutPreview()).resolves.toEqual({
      eligible_amount: 150.5,
      eligible_count: 2,
      locked_amount: 40,
      locked_count: 1,
      next_unlock_at: "2026-02-01T00:00:00Z",
      has_open_request: true,
      cases: [],
    });
    expect(rpcCalls[0].fn).toBe("get_my_payout_preview");
  });

  it("defaults everything when the RPC returns nothing", async () => {
    rpcResult = { data: null, error: null };
    await expect(getMyPayoutPreview()).resolves.toEqual({
      eligible_amount: 0,
      eligible_count: 0,
      locked_amount: 0,
      locked_count: 0,
      next_unlock_at: null,
      has_open_request: false,
      cases: [],
    });
  });

  it("throws the RPC error", async () => {
    rpcResult = { data: null, error: { message: "denied" } };
    await expect(getMyPayoutPreview()).rejects.toEqual({ message: "denied" });
  });
});

describe("requestPayoutViaChat", () => {
  it("passes notes through and returns the request payload", async () => {
    rpcResult = {
      data: { request_id: "r1", thread_id: "t1", amount: 100, case_count: 2 },
      error: null,
    };
    await expect(requestPayoutViaChat("please")).resolves.toEqual({
      request_id: "r1",
      thread_id: "t1",
      amount: 100,
      case_count: 2,
    });
    expect(rpcCalls[0]).toEqual({
      fn: "request_payout_via_chat",
      args: { p_notes: "please" },
    });
  });

  it("sends null notes when omitted", async () => {
    await requestPayoutViaChat();
    expect(rpcCalls[0].args).toEqual({ p_notes: null });
  });
});

describe("getPayoutRequestDetail", () => {
  it("forwards the request id", async () => {
    rpcResult = { data: { id: "r1", cases: [] }, error: null };
    await expect(getPayoutRequestDetail("r1")).resolves.toEqual({
      id: "r1",
      cases: [],
    });
    expect(rpcCalls[0]).toEqual({
      fn: "get_payout_request_detail",
      args: { p_request_id: "r1" },
    });
  });
});

describe("adminRespondPayoutRequest", () => {
  it("forwards action, note and transaction reference", async () => {
    await adminRespondPayoutRequest("r1", "pay", "done", "TXN-9");
    expect(rpcCalls[0]).toEqual({
      fn: "admin_respond_payout_request",
      args: {
        p_request_id: "r1",
        p_action: "pay",
        p_note: "done",
        p_transaction_ref: "TXN-9",
      },
    });
  });

  it("defaults the optional arguments to null", async () => {
    await adminRespondPayoutRequest("r1", "approve");
    expect(rpcCalls[0].args).toEqual({
      p_request_id: "r1",
      p_action: "approve",
      p_note: null,
      p_transaction_ref: null,
    });
  });

  it("throws the RPC error", async () => {
    rpcResult = { data: null, error: { message: "not allowed" } };
    await expect(adminRespondPayoutRequest("r1", "reject")).rejects.toEqual({
      message: "not allowed",
    });
  });
});
