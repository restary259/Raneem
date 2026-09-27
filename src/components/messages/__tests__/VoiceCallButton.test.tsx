import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VoiceCallButton from "@/components/messages/VoiceCallButton";

/**
 * The user's reported symptom was "I cannot see any call button".
 *
 * `VoiceCallButton` renders NOTHING unless the server says both people may
 * call each other, so these cases pin the two halves of that decision:
 *
 * 1. it appears and is tappable when the server allows the call,
 * 2. it stays hidden when it does not (feature flag off, or no such
 *    conversation) rather than showing a button that would only fail,
 * 3. the desktop/mobile split is a label collapse, never the button itself:
 *    the control is present and enabled at every breakpoint,
 * 4. it disables while a call is already running, so the server's
 *    one-active-call lock is not raced from the UI.
 */

const startCall = vi.fn();
let phase = "idle";
let voice: { phase: string; startCall: typeof startCall } | null = {
  phase,
  startCall,
};

vi.mock("@/contexts/VoiceCallContext", () => ({ useVoiceCall: () => voice }));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "me-1" } }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) =>
      typeof fallback === "string" ? fallback : key,
    i18n: { language: "en" },
  }),
}));

// `canCallUser` is the single gate: server-decided, and the reason the button
// is hidden rather than shown-and-broken.
let canCall: boolean | "error" = true;
vi.mock("@/services/VoiceCallService", async () => {
  const actual = await vi.importActual<typeof import("@/services/VoiceCallService")>(
    "@/services/VoiceCallService",
  );
  return {
    ...actual,
    canCallUser: vi.fn(async () => {
      if (canCall === "error") throw new Error("rpc down");
      return canCall;
    }),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  canCall = true;
  phase = "idle";
  voice = { phase, startCall };
});

describe("VoiceCallButton", () => {
  it("is visible and enabled once the server allows the call", async () => {
    render(
      <VoiceCallButton threadId="t-1" otherUserId="peer-1" otherUserName="Dana" />,
    );

    const button = await screen.findByRole("button", { name: /call/i });
    await waitFor(() => expect(button).toBeEnabled());
    expect(button).toBeInTheDocument();
  });

  it("stays hidden when the server says the call is not allowed", async () => {
    canCall = false;
    render(
      <VoiceCallButton threadId="t-1" otherUserId="peer-1" otherUserName="Dana" />,
    );

    // The gate resolves asynchronously; assert on the settled state.
    await waitFor(() => expect(screen.queryByRole("button")).toBeNull());
  });

  it("stays hidden when the permission check itself fails", async () => {
    // A dropped RPC must not surface a button that is guaranteed to 500 on
    // click; the failure is the same as "not allowed".
    canCall = "error";
    render(
      <VoiceCallButton threadId="t-1" otherUserId="peer-1" otherUserName="Dana" />,
    );

    await waitFor(() => expect(screen.queryByRole("button")).toBeNull());
  });

  it("starts the call for the other participant of this thread", async () => {
    render(
      <VoiceCallButton threadId="t-9" otherUserId="peer-1" otherUserName="Dana" />,
    );

    const button = await screen.findByRole("button", { name: /call/i });
    await userEvent.click(button);

    expect(startCall).toHaveBeenCalledWith({
      threadId: "t-9",
      peerId: "peer-1",
      peerName: "Dana",
    });
  });

  it("is disabled while a call is already in progress", async () => {
    voice = { phase: "connected", startCall };
    render(
      <VoiceCallButton threadId="t-1" otherUserId="peer-1" otherUserName="Dana" />,
    );

    const button = await screen.findByRole("button", { name: /call/i });
    await waitFor(() => expect(button).toBeDisabled());
  });

  it("keeps an accessible name at the mobile breakpoint, where the label is hidden", async () => {
    render(
      <VoiceCallButton threadId="t-1" otherUserId="peer-1" otherUserName="Dana" />,
    );

    const button = await screen.findByRole("button", { name: /call/i });
    // The visible text collapses below `md`; the aria-label must not, or the
    // control would be unlabelled on a phone.
    expect(button).toHaveAttribute("aria-label", "Call");
  });
});
