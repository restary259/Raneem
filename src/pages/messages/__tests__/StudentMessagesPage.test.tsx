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

  it("opens on the conversation list, not a chat", async () => {
    render(<StudentMessagesPage />);

    await waitFor(() => expect(screen.getByText("Case")).toBeInTheDocument());
    expect(screen.getByText("Payout")).toBeInTheDocument();
    expect(screen.queryByText(/case-chat:/)).not.toBeInTheDocument();
  });

  it("opens a conversation into the chat box and returns via the back arrow", async () => {
    const user = userEvent.setup();
    render(<StudentMessagesPage />);

    await waitFor(() => expect(screen.getByText("Case")).toBeInTheDocument());

    await user.click(screen.getByText("Case"));
    expect(await screen.findByText("case-chat:case-42")).toBeInTheDocument();

    // Emergency numbers stay reachable inside the chat box, as dial links.
    const emergency = screen
      .getAllByRole("link")
      .filter((a) => (a.getAttribute("href") ?? "").startsWith("tel:"));
    expect(emergency.length).toBeGreaterThanOrEqual(3);

    // The back arrow leaves the chat box and restores the list.
    const back = screen.getByRole("button", { name: "Back to conversations" });
    await user.click(back);

    await waitFor(() =>
      expect(screen.queryByText(/case-chat:/)).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Payout")).toBeInTheDocument();
  });

  it("opens the payout conversation from the list", async () => {
    const user = userEvent.setup();
    render(<StudentMessagesPage />);

    await waitFor(() => expect(screen.getByText("Payout")).toBeInTheDocument());

    await user.click(screen.getByText("Payout"));
    expect(await screen.findByText("direct-chat:payout-9")).toBeInTheDocument();
  });

  it("keeps the back arrow working in RTL (Arabic)", async () => {
    document.documentElement.dir = "rtl";
    const user = userEvent.setup();
    render(<StudentMessagesPage />);

    await waitFor(() => expect(screen.getByText("Case")).toBeInTheDocument());
    await user.click(screen.getByText("Case"));
    expect(await screen.findByText("case-chat:case-42")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Back to conversations" }),
    );
    await waitFor(() =>
      expect(screen.queryByText(/case-chat:/)).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Payout")).toBeInTheDocument();
  });

  it("lists the EXISTING Administration conversation on a fresh visit", async () => {
    render(<StudentMessagesPage />);

    // The admin thread is discovered from the direct threads, so it must appear
    // in the list without the student pressing anything first.
    await waitFor(() =>
      expect(
        screen.getByText("Your direct line to DARB Administration"),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("button", { name: /Message my team member/i }),
    ).not.toBeInTheDocument();
  });

  it("renders the Administration row and emergency contacts in order", async () => {
    render(<StudentMessagesPage />);

    const admin = await waitFor(() =>
      screen.getByText("Your direct line to DARB Administration").closest("li"),
    );
    const police = screen.getByText("Police");
    const ambulance = screen.getByText("Ambulance");
    const fire = screen.getByText("Fire Fighter");

    expect(admin).toBeTruthy();
    expect(
      admin!.compareDocumentPosition(police) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      police.compareDocumentPosition(ambulance) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      ambulance.compareDocumentPosition(fire) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    const emergencyLinks = screen
      .getAllByRole("link")
      .filter((a) => (a.getAttribute("href") ?? "").startsWith("tel:"));

    expect(emergencyLinks.map((a) => a.getAttribute("href"))).toEqual([
      "tel:110",
      "tel:112",
      "tel:112",
    ]);
  });

  it("starts the admin thread when the row has no thread yet", async () => {
    const user = userEvent.setup();

    adminThreadId = null;
    TABLE_ROWS.direct_thread_participants = [];
    TABLE_ROWS.direct_messages = [];
    TABLE_ROWS.direct_threads = [];

    render(<StudentMessagesPage />);

    await waitFor(() =>
      expect(screen.getByText("Administration")).toBeInTheDocument(),
    );

    await user.click(screen.getByText("Tap to start your conversation"));
    // The page calls `.rpc(name)` with one argument, but this suite's
    // integration mock forwards a second `args` parameter, so the recorded
    // call is ("start_student_admin_thread", undefined). Vitest compares
    // arity strictly, so assert on the first argument rather than the call tuple.
    await waitFor(() =>
      expect(
        mockRpc.mock.calls.some(
          ([name]) => name === "start_student_admin_thread",
        ),
      ).toBe(true),
    );
  });

  it("calls the admin-thread RPC only once when the row is tapped repeatedly", async () => {
    adminThreadId = null;
    TABLE_ROWS.direct_thread_participants = [];
    TABLE_ROWS.direct_messages = [];
    TABLE_ROWS.direct_threads = [];

    render(<StudentMessagesPage />);

    await waitFor(() =>
      expect(screen.getByText("Administration")).toBeInTheDocument(),
    );

    // Drop the mount-time resolve so only tap-driven calls are counted below.
    mockRpc.mockClear();

    // Hold the RPC open so the row stays in its pending state between taps —
    // this is the window in which a second tap used to fire a second call.
    // `any` keeps the deferred promise assignable to the mock's union return.
    let release: (value: unknown) => void = () => {};
    mockRpc.mockImplementationOnce(
      () =>
        new Promise<any>((resolve) => {
          release = resolve;
        }),
    );

    const row = screen.getByText("Tap to start your conversation");
    fireEvent.click(row);
    fireEvent.click(row);
    fireEvent.click(row);

    release({ data: "team-77", error: null });

    await waitFor(() =>
      expect(
        mockRpc.mock.calls.filter(
          ([name]) => name === "start_student_admin_thread",
        ).length,
      ).toBe(1),
    );
  });

  it("shows real activity and unread counts instead of blank rows", async () => {
    render(<StudentMessagesPage />);

    // Last message preview comes from the thread's message data. Scoped to the
    // Administration row: the payout row legitimately has no messages yet.
    await waitFor(() =>
      expect(
        screen.getByText("Administration").closest("li"),
      ).toHaveTextContent("Your appointment is confirmed"),
    );
    // The staff-authored, unread message marks the conversation title bold.
    expect(screen.getByText("Administration")).toHaveClass("font-bold");
  });

  it("labels an attachment-only message instead of reporting no messages", async () => {
    // The last message carries no body — only a document attachment.
    TEAM_LAST_MESSAGE.body = "";
    (TEAM_LAST_MESSAGE as { attachments: unknown }).attachments = [
      {
        kind: "document",
        mime: "application/pdf",
        name: "passport.pdf",
        url: "u",
      },
    ];
    render(<StudentMessagesPage />);

    await waitFor(() =>
      expect(
        screen.getByText("Administration").closest("li"),
      ).toHaveTextContent("Attachment"),
    );

    TEAM_LAST_MESSAGE.body = "Your appointment is confirmed";
    (TEAM_LAST_MESSAGE as { attachments: unknown }).attachments = null;
  });

  it("shows the Administration label in the OPEN chat header, never a named account", async () => {
    const user = userEvent.setup();
    render(<StudentMessagesPage />);

    await waitFor(() =>
      expect(
        screen.getByText("Your direct line to DARB Administration"),
      ).toBeInTheDocument(),
    );
    await user.click(
      screen.getByText("Your direct line to DARB Administration"),
    );

    expect(await screen.findByText("direct-chat:team-77")).toBeInTheDocument();
    // The header carries the same generic label as the list row — the student
    // never sees a named internal account.
    expect(screen.getAllByText("Administration").length).toBeGreaterThan(0);
    expect(screen.queryByText("Team Member")).not.toBeInTheDocument();
  });
});
