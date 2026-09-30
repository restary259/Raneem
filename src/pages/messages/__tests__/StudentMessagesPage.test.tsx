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

const mockRpc = vi.fn((name: string, _args?: unknown) => {
  if (name === "get_my_case") {
    return Promise.resolve({ data: [{ id: "case-42" }], error: null });
  }
  return Promise.resolve({ data: null, error: null });
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (name: string, args?: unknown) => mockRpc(name, args),
    // DirectMessageService subscribes at module scope — the mock must expose
    // every client surface the imported modules touch, or the file fails to load.
    auth: {
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
    },
    from: () => ({
      select: () => ({
        not: () => ({
          order: () => ({
            limit: () =>
              Promise.resolve({
                data: [{ thread_id: "payout-9" }],
                error: null,
              }),
          }),
        }),
      }),
    }),
  },
}));

import StudentMessagesPage from "../StudentMessagesPage";

describe("StudentMessagesPage — chat list ↔ chat box", () => {
  beforeEach(() => {
    mockRpc.mockClear();
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
});
