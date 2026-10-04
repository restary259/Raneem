/* eslint-disable @typescript-eslint/no-explicit-any -- loose types for untyped mock surfaces (supabase query builders, browser globals) */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Op = { op: string; args: unknown[] };
type TableState = { table: string; ops: Op[] };
type Result = { data: unknown; error: { message: string } | null };

let tableStates: TableState[] = [];
let tableResults: Record<string, Result> = {};
let invokeResult: { data: unknown; error: unknown } = {
  data: null,
  error: null,
};
let invokeCalls: Array<{ name: string; options: any }> = [];

function from(table: string) {
  const state: TableState = { table, ops: [] };
  tableStates.push(state);
  const result: Result = tableResults[table] ?? { data: null, error: null };
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
    functions: {
      invoke: (name: string, options: any) => {
        invokeCalls.push({ name, options });
        return Promise.resolve(invokeResult);
      },
    },
  },
}));

import {
  NotificationService,
  getNotificationPrefs,
  notifyNewMessageEmail,
  sendTestNotificationEmail,
  updateNotificationPrefs,
} from "./NotificationService";

beforeEach(() => {
  tableStates = [];
  tableResults = {};
  invokeResult = { data: null, error: null };
  invokeCalls = [];
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

const eqArgs = (state: TableState) =>
  state.ops.filter((o) => o.op === "eq").map((o) => o.args);

describe("NotificationService.listForUser", () => {
  it("queries the user's notifications newest-first with the limit", async () => {
    tableResults.notifications = { data: [{ id: "n1" }], error: null };
    await expect(NotificationService.listForUser("u1", 10)).resolves.toEqual([
      { id: "n1" },
    ]);
    const state = tableStates[0];
    expect(state.table).toBe("notifications");
    expect(eqArgs(state)).toContainEqual(["user_id", "u1"]);
    expect(state.ops).toContainEqual({
      op: "order",
      args: ["created_at", { ascending: false }],
    });
    expect(state.ops).toContainEqual({ op: "limit", args: [10] });
  });

  it("returns an empty array when data is null", async () => {
    tableResults.notifications = { data: null, error: null };
    await expect(NotificationService.listForUser("u1")).resolves.toEqual([]);
  });

  it("throws the query error", async () => {
    tableResults.notifications = { data: null, error: { message: "nope" } };
    await expect(NotificationService.listForUser("u1")).rejects.toEqual({
      message: "nope",
    });
  });
});

describe("NotificationService.markRead / markAllRead", () => {
  it("marks a single notification read on both legacy columns", async () => {
    await NotificationService.markRead("n1");
    const state = tableStates[0];
    expect(state.table).toBe("notifications");
    expect(state.ops[0]).toEqual({
      op: "update",
      args: [{ is_read: true, read: true }],
    });
    expect(eqArgs(state)).toContainEqual(["id", "n1"]);
  });

  it("marks only unread notifications for the user", async () => {
    await NotificationService.markAllRead("u1");
    const state = tableStates[0];
    expect(eqArgs(state)).toEqual([
      ["user_id", "u1"],
      ["is_read", false],
    ]);
  });

  it("propagates update errors", async () => {
    tableResults.notifications = { data: null, error: { message: "denied" } };
    await expect(NotificationService.markRead("n1")).rejects.toEqual({
      message: "denied",
    });
  });
});

describe("getNotificationPrefs", () => {
  it("defaults both preferences to true when no row exists", async () => {
    tableResults.profiles = { data: null, error: null };
    await expect(getNotificationPrefs("u1")).resolves.toEqual({
      notify_in_app: true,
      notify_email: true,
    });
  });

  it("returns the stored values", async () => {
    tableResults.profiles = {
      data: { notify_in_app: false, notify_email: true },
      error: null,
    };
    await expect(getNotificationPrefs("u1")).resolves.toEqual({
      notify_in_app: false,
      notify_email: true,
    });
  });

  it("throws the query error", async () => {
    tableResults.profiles = { data: null, error: { message: "boom" } };
    await expect(getNotificationPrefs("u1")).rejects.toEqual({
      message: "boom",
    });
  });
});

describe("updateNotificationPrefs", () => {
  it("strips must_change_password from the patch before writing", async () => {
    await updateNotificationPrefs("u1", {
      notify_in_app: false,
      must_change_password: true,
    } as never);
    const update = tableStates[0].ops.find((o) => o.op === "update");
    expect(update?.args[0]).toEqual({ notify_in_app: false });
    expect(eqArgs(tableStates[0])).toContainEqual(["id", "u1"]);
  });
});

describe("notifyNewMessageEmail", () => {
  it("invokes notify-new-message with a truncated preview", async () => {
    await notifyNewMessageEmail({
      threadType: "case",
      threadId: "c1",
      preview: "x".repeat(200),
    });
    expect(invokeCalls[0].name).toBe("notify-new-message");
    expect(invokeCalls[0].options.body).toEqual({
      thread_type: "case",
      thread_id: "c1",
      preview: "x".repeat(140),
    });
  });

  it("never throws when the invoke fails (email is best-effort)", async () => {
    invokeResult = { data: null, error: { message: "down" } };
    await expect(
      notifyNewMessageEmail({
        threadType: "direct",
        threadId: "d1",
        preview: "hi",
      }),
    ).resolves.toBeUndefined();
  });
});

describe("sendTestNotificationEmail", () => {
  it("returns the recipient on success", async () => {
    invokeResult = { data: { ok: true, to: "a@b.co" }, error: null };
    await expect(sendTestNotificationEmail()).resolves.toBe("a@b.co");
  });

  it("throws the provider message on invoke error", async () => {
    invokeResult = { data: null, error: { message: "smtp down" } };
    await expect(sendTestNotificationEmail()).rejects.toThrow("smtp down");
  });

  it("prefers the response body detail when the context can be read", async () => {
    invokeResult = {
      data: null,
      error: {
        message: "fallback",
        context: { text: async () => "body detail" },
      },
    };
    await expect(sendTestNotificationEmail()).rejects.toThrow("body detail");
  });

  it("falls back to the message when context.text() rejects", async () => {
    invokeResult = {
      data: null,
      error: {
        message: "fallback",
        context: {
          text: async () => {
            throw new Error("unreadable");
          },
        },
      },
    };
    await expect(sendTestNotificationEmail()).rejects.toThrow("fallback");
  });

  it("throws the body detail when the server reports ok:false", async () => {
    invokeResult = { data: { ok: false, detail: "not sent" }, error: null };
    await expect(sendTestNotificationEmail()).rejects.toThrow("not sent");
  });

  it("throws a default message when ok:false carries no detail", async () => {
    invokeResult = { data: { ok: false }, error: null };
    await expect(sendTestNotificationEmail()).rejects.toThrow("Email not sent");
  });
});
