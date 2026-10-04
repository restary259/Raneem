/* eslint-disable @typescript-eslint/no-explicit-any -- loose types for untyped mock surfaces (supabase query builders, browser globals) */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Op = { op: string; args: unknown[] };
type State = { table: string; ops: Op[] };
type Result = {
  data?: unknown;
  count?: number | null;
  error: { message: string; code?: string } | null;
};

let states: State[] = [];
let results: Record<string, Result> = {};
let rpcResult: Result = { data: null, error: null };
let rpcCalls: Array<{ fn: string; args?: Record<string, unknown> }> = [];

function from(table: string) {
  const state: State = { table, ops: [] };
  states.push(state);
  const result: Result = results[table] ?? { data: null, error: null };
  const chain: any = {
    select: (...args: unknown[]) => (
      state.ops.push({ op: "select", args }),
      chain
    ),
    insert: (...args: unknown[]) => {
      state.ops.push({ op: "insert", args });
      return Promise.resolve(result);
    },
    delete: (...args: unknown[]) => (
      state.ops.push({ op: "delete", args }),
      chain
    ),
    eq: (...args: unknown[]) => (state.ops.push({ op: "eq", args }), chain),
    neq: (...args: unknown[]) => (state.ops.push({ op: "neq", args }), chain),
    gt: (...args: unknown[]) => (state.ops.push({ op: "gt", args }), chain),
    in: (...args: unknown[]) => (state.ops.push({ op: "in", args }), chain),
    is: (...args: unknown[]) => (state.ops.push({ op: "is", args }), chain),
    order: (...args: unknown[]) => (
      state.ops.push({ op: "order", args }),
      chain
    ),
    limit: (...args: unknown[]) => (
      state.ops.push({ op: "limit", args }),
      chain
    ),
    maybeSingle: () => Promise.resolve(result),
    then: (resolve: (v: Result) => void) =>
      Promise.resolve(result).then(resolve),
  };
  return chain;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => from(table),
    rpc: (fn: string, args?: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      return Promise.resolve(rpcResult);
    },
  },
}));

import {
  clearCaseThread,
  deleteChatMessage,
  editCaseMessage,
  fulfilDocumentRequest,
  getCaseLastRead,
  getThreadReadState,
  listCaseMessages,
  listMutedThreads,
  listMyCaseThreads,
  markCaseMessagesRead,
  resolveCaseRefs,
  searchCasesForMention,
  sendCaseMessage,
  setThreadMuted,
  toChatMessage,
  totalUnreadCaseMessages,
  unreadCaseMessageCount,
  type CaseMessage,
} from "./CaseMessageService";

beforeEach(() => {
  states = [];
  results = {};
  rpcResult = { data: null, error: null };
  rpcCalls = [];
});

const message = (overrides: Partial<CaseMessage> = {}): CaseMessage => ({
  id: "m1",
  case_id: "c1",
  author_id: "u1",
  author_role: "agent",
  author_name: "Layla",
  body: "hello",
  visibility: "shared",
  created_at: "2026-01-01T10:00:00Z",
  attachments: null,
  kind: "text",
  request_status: null,
  ...overrides,
});

describe("toChatMessage", () => {
  it("maps nullable columns to safe defaults", () => {
    expect(
      toChatMessage(
        message({
          attachments: null,
          kind: null,
          mentions: null,
          edited_at: null,
        }),
      ),
    ).toEqual({
      id: "m1",
      authorId: "u1",
      authorName: "Layla",
      authorRole: "agent",
      body: "hello",
      createdAt: "2026-01-01T10:00:00Z",
      visibility: "shared",
      attachments: [],
      kind: "text",
      requestStatus: null,
      editedAt: null,
      mentions: [],
    });
  });

  it("preserves populated fields", () => {
    const out = toChatMessage(
      message({
        kind: "request",
        request_status: "open",
        mentions: ["u2"],
        edited_at: "2026-01-02T00:00:00Z",
        attachments: [
          { name: "a.pdf", path: "p", mime: "application/pdf", size: 1 },
        ],
      }),
    );
    expect(out.kind).toBe("request");
    expect(out.requestStatus).toBe("open");
    expect(out.mentions).toEqual(["u2"]);
    expect(out.editedAt).toBe("2026-01-02T00:00:00Z");
    expect(out.attachments).toHaveLength(1);
  });
});

describe("listCaseMessages", () => {
  it("excludes deleted rows and reverses to oldest-first", async () => {
    results.case_messages = {
      data: [message({ id: "new" }), message({ id: "old" })],
      error: null,
    };
    await expect(listCaseMessages("c1", 20)).resolves.toEqual([
      expect.objectContaining({ id: "old" }),
      expect.objectContaining({ id: "new" }),
    ]);
    const state = states[0];
    expect(state.ops).toContainEqual({ op: "eq", args: ["case_id", "c1"] });
    expect(state.ops).toContainEqual({ op: "is", args: ["deleted_at", null] });
    expect(state.ops).toContainEqual({
      op: "order",
      args: ["created_at", { ascending: false }],
    });
    expect(state.ops).toContainEqual({ op: "limit", args: [20] });
  });

  it("returns [] for no data", async () => {
    results.case_messages = { data: null, error: null };
    await expect(listCaseMessages("c1")).resolves.toEqual([]);
  });
});

describe("sendCaseMessage", () => {
  it("rejects an empty body with no attachments", async () => {
    await expect(sendCaseMessage("c1", "   ")).rejects.toThrow(
      "Message body required",
    );
    expect(rpcCalls).toHaveLength(0);
  });

  it("allows an empty body when there is an attachment", async () => {
    rpcResult = { data: "m9", error: null };
    await sendCaseMessage("c1", "  ", "shared", [
      { name: "a", path: "p", mime: "image/png", size: 1 },
    ]);
    expect(rpcCalls[0].args?.p_attachments).toHaveLength(1);
  });

  it("trims the body and forwards the full payload", async () => {
    rpcResult = { data: "m9", error: null };
    await expect(
      sendCaseMessage("c1", "  hi  ", "internal", [], "request", ["u2"]),
    ).resolves.toBe("m9");
    expect(rpcCalls[0]).toEqual({
      fn: "send_case_message",
      args: {
        p_case_id: "c1",
        p_body: "hi",
        p_visibility: "internal",
        p_attachments: [],
        p_kind: "request",
        p_mentions: ["u2"],
      },
    });
  });

  it("throws the RPC error", async () => {
    rpcResult = { data: null, error: { message: "denied" } };
    await expect(sendCaseMessage("c1", "hi")).rejects.toEqual({
      message: "denied",
    });
  });
});

describe("editCaseMessage", () => {
  it("trims the body and forwards the message id", async () => {
    await editCaseMessage("m1", "  updated  ");
    expect(rpcCalls[0]).toEqual({
      fn: "edit_case_message",
      args: { p_message_id: "m1", p_body: "updated" },
    });
  });
});

describe("getThreadReadState / getCaseLastRead", () => {
  it("forwards kind and id to the RPC", async () => {
    rpcResult = { data: [{ user_id: "u1" }], error: null };
    await expect(getThreadReadState("case", "c1")).resolves.toEqual([
      { user_id: "u1" },
    ]);
    expect(rpcCalls[0]).toEqual({
      fn: "get_thread_read_state",
      args: { p_kind: "case", p_id: "c1" },
    });
  });

  it("reads the last_read_at marker for the user", async () => {
    results.case_message_reads = {
      data: { last_read_at: "2026-01-01T00:00:00Z" },
      error: null,
    };
    await expect(getCaseLastRead("c1", "u1")).resolves.toBe(
      "2026-01-01T00:00:00Z",
    );
    const state = states[0];
    expect(state.ops).toContainEqual({ op: "eq", args: ["case_id", "c1"] });
    expect(state.ops).toContainEqual({ op: "eq", args: ["user_id", "u1"] });
  });

  it("returns null when there is no marker", async () => {
    results.case_message_reads = { data: null, error: null };
    await expect(getCaseLastRead("c1", "u1")).resolves.toBeNull();
  });
});

describe("unreadCaseMessageCount", () => {
  it("counts messages from other authors without a read marker", async () => {
    results.case_message_reads = { data: null, error: null };
    results.case_messages = { count: 3, data: null, error: null };
    await expect(unreadCaseMessageCount("c1", "u1")).resolves.toBe(3);
    const state = states.find((s) => s.table === "case_messages")!;
    expect(state.ops).toContainEqual({ op: "neq", args: ["author_id", "u1"] });
    expect(state.ops.some((o) => o.op === "gt")).toBe(false);
  });

  it("bounds the count by the last read timestamp when present", async () => {
    results.case_message_reads = {
      data: { last_read_at: "2026-01-01T00:00:00Z" },
      error: null,
    };
    results.case_messages = { count: 1, data: null, error: null };
    await expect(unreadCaseMessageCount("c1", "u1")).resolves.toBe(1);
    const state = states.find((s) => s.table === "case_messages")!;
    expect(state.ops).toContainEqual({
      op: "gt",
      args: ["created_at", "2026-01-01T00:00:00Z"],
    });
  });

  it("defaults to 0 when count is null", async () => {
    results.case_message_reads = { data: null, error: null };
    results.case_messages = { count: null, data: null, error: null };
    await expect(unreadCaseMessageCount("c1", "u1")).resolves.toBe(0);
  });
});

describe("listMyCaseThreads", () => {
  it("groups by case, counts unread, and drops orphaned threads", async () => {
    results.case_messages = {
      data: [
        message({
          id: "m3",
          case_id: "c1",
          author_id: "u2",
          created_at: "2026-01-03T00:00:00Z",
        }),
        message({
          id: "m2",
          case_id: "c2",
          author_id: "u2",
          created_at: "2026-01-02T00:00:00Z",
        }),
        message({
          id: "m1",
          case_id: "c1",
          author_id: "u2",
          created_at: "2026-01-01T00:00:00Z",
        }),
      ],
      error: null,
    };
    results.cases = {
      data: [
        {
          id: "c1",
          full_name: "Layla",
          case_reference: "REF-1",
          status: "active",
        },
        // c2 intentionally missing => orphaned
      ],
      error: null,
    };
    results.case_message_reads = {
      data: [{ case_id: "c1", last_read_at: "2026-01-02T12:00:00Z" }],
      error: null,
    };

    const threads = await listMyCaseThreads("u1");
    expect(threads).toHaveLength(1);
    expect(threads[0]).toMatchObject({
      caseId: "c1",
      caseName: "Layla",
      caseReference: "REF-1",
      caseStatus: "active",
      unread: 1, // m3 is newer than the read marker; m1 is not
    });
    expect(threads[0].lastMessage.id).toBe("m3");
  });

  it("returns [] without secondary queries when there are no messages", async () => {
    results.case_messages = { data: [], error: null };
    await expect(listMyCaseThreads("u1")).resolves.toEqual([]);
    expect(states.filter((s) => s.table === "cases")).toHaveLength(0);
  });

  it("sorts threads by most recent message", async () => {
    results.case_messages = {
      data: [
        message({ id: "a", case_id: "c1", created_at: "2026-01-01T00:00:00Z" }),
        message({ id: "b", case_id: "c2", created_at: "2026-01-05T00:00:00Z" }),
      ],
      error: null,
    };
    results.cases = {
      data: [
        { id: "c1", full_name: "A", case_reference: null, status: "active" },
        { id: "c2", full_name: "B", case_reference: null, status: "active" },
      ],
      error: null,
    };
    results.case_message_reads = { data: [], error: null };
    const threads = await listMyCaseThreads("u1");
    expect(threads.map((t) => t.caseId)).toEqual(["c2", "c1"]);
  });
});

describe("totalUnreadCaseMessages", () => {
  it("sums unread across all threads", async () => {
    results.case_messages = {
      data: [
        message({
          id: "a",
          case_id: "c1",
          author_id: "u2",
          created_at: "2026-01-01T00:00:00Z",
        }),
        message({
          id: "b",
          case_id: "c2",
          author_id: "u2",
          created_at: "2026-01-02T00:00:00Z",
        }),
      ],
      error: null,
    };
    results.cases = {
      data: [
        { id: "c1", full_name: "A", case_reference: null, status: "active" },
        { id: "c2", full_name: "B", case_reference: null, status: "active" },
      ],
      error: null,
    };
    results.case_message_reads = { data: [], error: null };
    await expect(totalUnreadCaseMessages("u1")).resolves.toBe(2);
  });
});

describe("mutes", () => {
  it("lists muted threads for the user", async () => {
    results.message_thread_mutes = {
      data: [{ thread_type: "case", thread_id: "c1" }],
      error: null,
    };
    await expect(listMutedThreads("u1")).resolves.toEqual([
      { thread_type: "case", thread_id: "c1" },
    ]);
  });

  it("inserts a mute and tolerates the 23505 duplicate error", async () => {
    results.message_thread_mutes = {
      data: null,
      error: { message: "dup", code: "23505" },
    };
    await expect(
      setThreadMuted("u1", "case", "c1", true),
    ).resolves.toBeUndefined();
    expect(states[0].ops[0]).toEqual({
      op: "insert",
      args: [{ user_id: "u1", thread_type: "case", thread_id: "c1" }],
    });
  });

  it("rethrows a non-duplicate insert error", async () => {
    results.message_thread_mutes = {
      data: null,
      error: { message: "denied", code: "42501" },
    };
    await expect(setThreadMuted("u1", "case", "c1", true)).rejects.toEqual({
      message: "denied",
      code: "42501",
    });
  });

  it("deletes a mute when unmuting", async () => {
    await setThreadMuted("u1", "direct", "d1", false);
    const state = states[0];
    expect(state.ops[0]).toEqual({ op: "delete", args: [] });
    expect(state.ops).toContainEqual({ op: "eq", args: ["user_id", "u1"] });
    expect(state.ops).toContainEqual({
      op: "eq",
      args: ["thread_type", "direct"],
    });
    expect(state.ops).toContainEqual({ op: "eq", args: ["thread_id", "d1"] });
  });
});

describe("case mentions", () => {
  it("forwards the mention query", async () => {
    rpcResult = {
      data: [
        { id: "c1", case_reference: "REF-1", full_name: "A", status: "active" },
      ],
      error: null,
    };
    await expect(searchCasesForMention("REF")).resolves.toEqual([
      { id: "c1", case_reference: "REF-1", full_name: "A", status: "active" },
    ]);
    expect(rpcCalls[0]).toEqual({
      fn: "search_cases_for_mention",
      args: { p_query: "REF" },
    });
  });

  it("maps #REF tokens by reference or short id", async () => {
    let call = 0;
    vi.resetModules();
    // Re-mock with a search that answers per query.
    vi.doMock("@/integrations/supabase/client", () => ({
      supabase: {
        rpc: (fn: string, args: Record<string, unknown>) => {
          call += 1;
          if (String(args.p_query).toLowerCase() === "ref-1") {
            return Promise.resolve({
              data: [
                {
                  id: "c1",
                  case_reference: "REF-1",
                  full_name: "A",
                  status: "active",
                },
              ],
              error: null,
            });
          }
          return Promise.resolve({
            data: [
              {
                id: "abcdef12",
                case_reference: null,
                full_name: "B",
                status: "active",
              },
            ],
            error: null,
          });
        },
      },
    }));
    const { resolveCaseRefs: fresh } = await import("./CaseMessageService");
    const map = await fresh(["ref-1", "abcdef12", "missing"]);
    expect(map.get("ref-1")).toBe("c1");
    expect(map.get("abcdef12")).toBe("abcdef12");
    expect(map.has("missing")).toBe(false);
    expect(call).toBe(3);
    vi.doUnmock("@/integrations/supabase/client");
  });

  it("ignores per-ref search failures", async () => {
    rpcResult = { data: null, error: { message: "denied" } };
    await expect(resolveCaseRefs(["REF-1"])).resolves.toEqual(new Map());
  });
});

describe("moderation", () => {
  it("deleteChatMessage forwards id and kind", async () => {
    await deleteChatMessage("m1", "direct");
    expect(rpcCalls[0]).toEqual({
      fn: "delete_chat_message",
      args: { p_message_id: "m1", p_kind: "direct" },
    });
  });

  it("clearCaseThread coerces the returned count", async () => {
    rpcResult = { data: 4, error: null };
    await expect(clearCaseThread("c1")).resolves.toBe(4);
  });

  it("clearCaseThread defaults to 0 when the RPC returns null", async () => {
    rpcResult = { data: null, error: null };
    await expect(clearCaseThread("c1")).resolves.toBe(0);
  });
});

describe("markCaseMessagesRead", () => {
  it("calls the RPC and dispatches the threads-read event", async () => {
    const listener = vi.fn();
    window.addEventListener("darb:threads-read", listener);
    await markCaseMessagesRead("c1");
    expect(rpcCalls[0]).toEqual({
      fn: "mark_case_messages_read",
      args: { p_case_id: "c1" },
    });
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener("darb:threads-read", listener);
  });
});

describe("fulfilDocumentRequest", () => {
  it("forwards the message id and attachment", async () => {
    const attachment = {
      name: "a",
      path: "p",
      mime: "application/pdf",
      size: 1,
    };
    await fulfilDocumentRequest("m1", attachment);
    expect(rpcCalls[0]).toEqual({
      fn: "fulfil_document_request",
      args: { p_message_id: "m1", p_attachment: attachment },
    });
  });
});
