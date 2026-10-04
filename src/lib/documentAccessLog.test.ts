import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let rpcResult: { error: { message: string } | null } = { error: null };
let rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      return Promise.resolve(rpcResult);
    },
  },
}));

import { logDocumentAccess } from "./documentAccessLog";

beforeEach(() => {
  rpcCalls = [];
  rpcResult = { error: null };
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("logDocumentAccess", () => {
  it("does nothing for a missing document id", async () => {
    logDocumentAccess(undefined);
    logDocumentAccess(null);
    await Promise.resolve();
    expect(rpcCalls).toHaveLength(0);
  });

  it("defaults to the download action", async () => {
    logDocumentAccess("doc-1");
    await vi.waitFor(() => expect(rpcCalls).toHaveLength(1));
    expect(rpcCalls[0]).toEqual({
      fn: "log_document_access",
      args: { _document_id: "doc-1", _action: "download" },
    });
  });

  it("passes an explicit action through", async () => {
    logDocumentAccess("doc-2", "preview");
    await vi.waitFor(() => expect(rpcCalls).toHaveLength(1));
    expect(rpcCalls[0].args._action).toBe("preview");
  });

  it("logs but never throws when the RPC fails", async () => {
    rpcResult = { error: { message: "denied" } };
    logDocumentAccess("doc-3", "view");
    await vi.waitFor(() =>
      expect(console.warn).toHaveBeenCalledWith(
        "[documentAccessLog]",
        "denied",
      ),
    );
  });
});
