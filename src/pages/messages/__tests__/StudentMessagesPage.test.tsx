import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * The page reads the `dashboard` namespace, which the vitest runtime never
 * loads — dashboard.json lives in public/locales and is fetched over HTTP. This
 * map mirrors the English values the page actually reads, so the mock returns
 * real strings instead of raw keys and the assertions below test rendered text.
 */
const EN: Record<string, string> = {
  "chat.adminLabel": "Administration",
  "chat.backToChats": "Back to conversations",
  "chat.type.case": "Case",
  "chat.type.direct": "Direct",
  "chat.attach.only": "Attachment",
  "chat.voice.message": "Voice message",
  "messagesInbox.title": "Case messages",
  "messagesInbox.studentSubtitle": "Talk directly with your advisor.",
  "messagesInbox.myCaseTitle": "My DARB Case",
  "messagesInbox.myCaseHint": "Message your DARB team",
  "messagesInbox.payoutTab": "Payout",
  "messagesInbox.payoutConversationHint": "Your payout conversation",
  "messagesInbox.adminConversationHint":
    "Your direct line to DARB Administration",
  "messagesInbox.openConversation": "Open the conversation",
  "messagesInbox.noMessagesYet": "No messages yet",
  "messagesInbox.startTeamPreview": "Tap to start your conversation",
  "messagesInbox.empty": "No conversations yet.",
  "messagesInbox.startingTeamChat": "Opening your team chat…",
  "messagesInbox.emergency.title": "Emergency services",
  "messagesInbox.emergency.police": "Police",
  "messagesInbox.emergency.ambulance": "Ambulance",
  "messagesInbox.emergency.fire": "Fire Fighter",
  "messagesInbox.emergency.call": "Call {{number}}",
  "messagesInbox.emergency.action": "Call",
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrOptions?: unknown, maybeOptions?: unknown) => {
      const template =
        EN[key] ??
        (typeof fallbackOrOptions === "string" ? fallbackOrOptions : key);
      const options =
        typeof fallbackOrOptions === "object" && fallbackOrOptions !== null
          ? (fallbackOrOptions as Record<string, unknown>)
          : (maybeOptions as Record<string, unknown> | undefined);
      if (!options) return template;
      return template.replace(/\{\{(\w+)\}\}/g, (_match, name: string) =>
        String(options[name] ?? ""),
      );
    },
    i18n: { language: "en" },
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "student-1" }, role: "student" }),
}));

vi.mock("@/hooks/use-toast", () => {
  // Stable function identity: the page lists `toast` in a useEffect dependency
  // array, so a fresh mock per render would re-run the mount effect forever.
  const toast = vi.fn();
  return { useToast: () => ({ toast }) };
});

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));

// The chat bodies pull their own data; the navigation contract under test does
// not need them to render real messages.
vi.mock("@/components/cases/CaseMessages", () => ({
  default: ({ caseId }: { caseId: string }) => <div>case-chat:{caseId}</div>,
}));
vi.mock("@/components/messages/DirectMessages", () => ({
  default: ({ threadId }: { threadId: string }) => (
    <div>direct-chat:{threadId}</div>
  ),
}));
vi.mock("@/components/messages/VoiceCallButton", () => ({
  default: () => <div>voice-call</div>,
}));

// The page resolves the student's admin thread on mount (idempotent RPC). Tests
// that exercise the "no thread yet" pending row set this to null before render.
let adminThreadId: string | null = "team-77";

const mockRpc = vi.fn((name: string, _args?: unknown) => {
  if (name === "get_my_case") {
    return Promise.resolve({ data: [{ id: "case-42" }], error: null });
  }
  // The student's direct line is Administration, opened via the idempotent
  // admin thread RPC (the page no longer opens a named team-member thread).
  if (name === "start_student_admin_thread") {
    return Promise.resolve({ data: adminThreadId, error: null });
  }
  return Promise.resolve({ data: null, error: null });
});

// One row per table the page reads: `payout_requests` supplies the payout
// thread id, and `listMyDirectThreads` reads direct_thread_participants /
// direct_messages / direct_threads to derive activity and the team thread.
const TEAM_LAST_MESSAGE = {
  id: "m-team",
  thread_id: "team-77",
  author_id: "staff-1",
  author_name: "DARB Team",
  author_role: "admin",
  body: "Your appointment is confirmed",
  created_at: new Date().toISOString(),
  attachments: null,
};

const TABLE_ROWS: Record<string, unknown[]> = {
  payout_requests: [{ thread_id: "payout-9" }],
  direct_thread_participants: [
    {
      thread_id: "team-77",
      user_id: "student-1",
      last_read_at: "2020-01-01T00:00:00Z",
    },
    { thread_id: "team-77", user_id: "staff-1", last_read_at: null },
  ],
  direct_messages: [TEAM_LAST_MESSAGE],
  direct_threads: [
    { id: "team-77", last_message_at: TEAM_LAST_MESSAGE.created_at },
  ],
  profiles: [],
};

const BASE_TABLE_ROWS = Object.fromEntries(
  Object.entries(TABLE_ROWS).map(([key, rows]) => [key, rows.slice()]),
);

vi.mock("@/integrations/supabase/client", () => {
  const chain = (rows: unknown[]) => {
    const result = Promise.resolve({ data: rows, error: null });
    const api: Record<string, unknown> = {};
    for (const method of ["select", "eq", "in", "not", "order", "limit"]) {
      api[method] = () => api;
    }
    api.then = (...args: unknown[]) =>
      (result.then as (...a: unknown[]) => unknown)(...args);
    return api;
  };
  return {
    supabase: {
      rpc: (name: string, args?: unknown) => mockRpc(name, args),
      // DirectMessageService subscribes at module scope — the mock must expose
      // every client surface the imported modules touch, or the file fails to load.
      auth: {
        onAuthStateChange: () => ({
          data: { subscription: { unsubscribe: () => {} } },
        }),
      },
      from: (table: string) => chain(TABLE_ROWS[table] ?? []),
    },
  };
});

import StudentMessagesPage from "../StudentMessagesPage";

describe("StudentMessagesPage — chat list ↔ chat box", () => {
  beforeEach(() => {
    mockRpc.mockClear();
    adminThreadId = "team-77";
    document.documentElement.dir = "ltr";
    for (const [key, rows] of Object.entries(BASE_TABLE_ROWS)) {
      TABLE_ROWS[key] = rows.slice();
    }
  });

  it("lists only the case thread — no direct Administration/team row", async () => {
    render(<StudentMessagesPage />);

    await waitFor(() =>
      expect(screen.getByText("My DARB Case")).toBeInTheDocument(),
    );
    expect(screen.queryByText("Administration")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Your direct line to DARB Administration"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/case-chat:/)).not.toBeInTheDocument();
  });

  it("never opens a direct admin/team thread on load", async () => {
    render(<StudentMessagesPage />);
    await waitFor(() =>
      expect(screen.getByText("My DARB Case")).toBeInTheDocument(),
    );
    const called = mockRpc.mock.calls.map(([name]) => name);
    expect(called).not.toContain("start_student_admin_thread");
    expect(called).not.toContain("start_direct_thread");
  });

  it("opens the case chat and returns via the back arrow (RTL too)", async () => {
    document.documentElement.dir = "rtl";
    const user = userEvent.setup();
    render(<StudentMessagesPage />);

    await waitFor(() =>
      expect(screen.getByText("My DARB Case")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("My DARB Case"));
    expect(await screen.findByText("case-chat:case-42")).toBeInTheDocument();

    const emergency = screen
      .getAllByRole("link")
      .filter((a) => (a.getAttribute("href") ?? "").startsWith("tel:"));
    expect(emergency.length).toBeGreaterThanOrEqual(3);

    await user.click(
      screen.getByRole("button", { name: "Back to conversations" }),
    );
    await waitFor(() =>
      expect(screen.queryByText(/case-chat:/)).not.toBeInTheDocument(),
    );
  });
});
