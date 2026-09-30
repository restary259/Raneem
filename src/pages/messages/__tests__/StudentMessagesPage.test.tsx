import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) =>
      typeof fallback === "string" ? fallback : key,
    i18n: { language: "en" },
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "student-1" }, role: "student" }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

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

const DEFAULT_STAFF_DIRECTORY = [
  { id: "staff-1", full_name: "Raneem", role: "team_member" },
];
// Mutable so a test can simulate a real student, who is DENIED the staff
// directory (it is admin/team-only) and therefore gets no counterpart role.
let staffDirectoryRows: unknown[] = DEFAULT_STAFF_DIRECTORY;

const mockRpc = vi.fn((name: string, _args?: unknown) => {
  if (name === "get_my_case") {
    return Promise.resolve({ data: [{ id: "case-42" }], error: null });
  }
  if (name === "start_student_team_member_thread") {
    return Promise.resolve({ data: "team-77", error: null });
  }
  // listMyDirectThreads resolves the counterpart's role/name from the staff
  // directory; without it the team thread cannot be identified.
  if (name === "get_staff_directory") {
    return Promise.resolve({ data: staffDirectoryRows, error: null });
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
  author_name: "Raneem",
  author_role: "team_member",
  body: "Your appointment is confirmed",
  created_at: new Date().toISOString(),
  attachments: null,
};

const TABLE_ROWS: Record<string, unknown[]> = {
  payout_requests: [{ thread_id: "payout-9" }],
  direct_thread_participants: [
    { thread_id: "team-77", user_id: "student-1", last_read_at: "2020-01-01T00:00:00Z" },
    { thread_id: "team-77", user_id: "staff-1", last_read_at: null },
  ],
  direct_messages: [TEAM_LAST_MESSAGE],
  direct_threads: [{ id: "team-77", last_message_at: TEAM_LAST_MESSAGE.created_at }],
  profiles: [],
};

// vi.mock is hoisted above the const declarations, so the listener registry must
// be created with vi.hoisted to exist before DirectMessageService subscribes.
const { authListeners } = vi.hoisted(() => ({
  authListeners: [] as Array<() => void>,
}));

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
      // The listener is also how a test clears the module-level staff-directory
      // cache (it is keyed to auth changes and otherwise lives for 5 minutes).
      auth: {
        onAuthStateChange: (cb: () => void) => {
          authListeners.push(cb);
          return { data: { subscription: { unsubscribe: () => {} } } };
        },
      },
      from: (table: string) => chain(TABLE_ROWS[table] ?? []),
    },
  };
});

import StudentMessagesPage from "../StudentMessagesPage";

describe("StudentMessagesPage — chat list ↔ chat box", () => {
  beforeEach(() => {
    mockRpc.mockClear();
    staffDirectoryRows = DEFAULT_STAFF_DIRECTORY;
    // Drop the module-level staff-directory cache so each test sees its own rows.
    authListeners.forEach((cb) => cb());
    document.documentElement.dir = "ltr";
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

  it("lists an EXISTING team conversation on a fresh visit", async () => {
    render(<StudentMessagesPage />);

    // The team thread is discovered from the direct threads, so it must appear
    // in the list without the student pressing "Message my team member" first.
    await waitFor(() =>
      expect(screen.getByText("Your direct line to your advisor")).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("button", { name: /Message my team member/i }),
    ).not.toBeInTheDocument();
  });

  it("lists the existing team conversation even when the staff directory is denied", async () => {
    // The real student condition: get_staff_directory is admin/team-only, so a
    // student gets NO rows and the counterpart role resolves to null. The thread
    // must still be found — only the payout thread is excluded, not by role.
    staffDirectoryRows = [];
    render(<StudentMessagesPage />);

    await waitFor(() =>
      expect(screen.getByText("Your direct line to your advisor")).toBeInTheDocument(),
    );
    // The name falls back to the neutral staff label — a student never sees a
    // real admin/team name.
    expect(screen.queryByText("Raneem")).not.toBeInTheDocument();
  });

  it("shows real activity and unread counts instead of blank rows", async () => {
    render(<StudentMessagesPage />);

    // Last message preview comes from the thread's message data. Scoped to the
    // team row: the payout row legitimately has no messages yet.
    await waitFor(() =>
      expect(screen.getByText("Raneem").closest("li")).toHaveTextContent(
        "Your appointment is confirmed",
      ),
    );
    // The staff-authored, unread message marks the conversation title bold.
    expect(screen.getByText("Raneem")).toHaveClass("font-bold");
  });

  it("labels an attachment-only message instead of reporting no messages", async () => {
    // The last message carries no body — only a document attachment.
    TEAM_LAST_MESSAGE.body = "";
    (TEAM_LAST_MESSAGE as { attachments: unknown }).attachments = [
      { kind: "document", mime: "application/pdf", name: "passport.pdf", url: "u" },
    ];
    render(<StudentMessagesPage />);

    await waitFor(() =>
      expect(screen.getByText("Raneem").closest("li")).toHaveTextContent(
        "Attachment",
      ),
    );

    TEAM_LAST_MESSAGE.body = "Your appointment is confirmed";
    (TEAM_LAST_MESSAGE as { attachments: unknown }).attachments = null;
  });

  it("uses the resolved advisor name in the OPEN chat header", async () => {
    const user = userEvent.setup();
    render(<StudentMessagesPage />);

    await waitFor(() =>
      expect(screen.getByText("Your direct line to your advisor")).toBeInTheDocument(),
    );
    await user.click(screen.getByText("Your direct line to your advisor"));

    expect(await screen.findByText("direct-chat:team-77")).toBeInTheDocument();
    // Header and list agree on the resolved name — never the generic fallback.
    expect(screen.getByText("Raneem")).toBeInTheDocument();
    expect(screen.queryByText("Team Member")).not.toBeInTheDocument();
  });
});
