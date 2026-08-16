import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import MemberDetailDrawer from "../MemberDetailDrawer";
import type { MemberRow } from "../MemberList";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_k: string, fallback?: any) =>
      typeof fallback === "string" ? fallback : (fallback?.defaultValue ?? _k),
  }),
}));

// Stub role-action toggle components so the test focuses on the drawer shell + KPIs.
vi.mock("../MasterPartnerToggle", () => ({
  default: () => <div data-testid="master-toggle" />,
}));
vi.mock("../AgentInviteToggle", () => ({
  default: () => <div data-testid="invite-toggle" />,
}));
vi.mock("../AgentCreateAccountsToggle", () => ({
  default: () => <div data-testid="create-accounts-toggle" />,
}));
vi.mock("../DeactivateAccountDialog", () => ({
  default: ({ open }: { open: boolean }) =>
    open ? <div data-testid="deactivate-dialog" /> : null,
}));

// --- Supabase mock -----------------------------------------------------------

let rpcResult: { data: any; error: any } | null = null;
let rpcDelays: number[] = [];
const rpcCalls: string[] = [];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(async (fn: string, _args: any) => {
      rpcCalls.push(fn);
      const delay = rpcDelays.shift() ?? 0;
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      if (rpcResult) return rpcResult;
      return { data: null, error: new Error("no mock") };
    }),
  },
}));

function makeMember(overrides: Partial<MemberRow> = {}): MemberRow {
  return {
    requester_id: "user-1",
    full_name: "Test Member",
    email: "test@example.com",
    phone_number: null,
    role: "team_member",
    is_deactivated: false,
    is_master_partner: false,
    master_partner_id: null,
    agent_id: null,
    referral_code: null,
    assigned_cases: 5,
    enrolled_cases: 3,
    team_reward_total: 1500,
    recruited_count: 0,
    earned_override: 0,
    students_count: 0,
    earned_referral: 0,
    earned_master_override: 0,
    total_earned: 5000,
    paid_amount: 2000,
    locked_amount: 1000,
    available_amount: 2000,
    created_at: "2024-01-15T00:00:00Z",
    ...overrides,
  } as MemberRow;
}

describe("MemberDetailDrawer", () => {
  beforeEach(() => {
    rpcResult = null;
    rpcDelays = [];
    rpcCalls.length = 0;
  });

  it("renders a Sheet side panel (not a vaul bottom-sheet Drawer)", () => {
    const member = makeMember();
    render(
      <MemberDetailDrawer member={member} open={true} onOpenChange={() => {}} />
    );
    // Radix Dialog (Sheet) renders into a portal in document.body.
    const panel = document.body.querySelector("[role=dialog]");
    expect(panel).toBeTruthy();
    // The Sheet content should have right-anchored classes, not bottom-anchored.
    expect(panel?.className).toContain("right-0");
    expect(panel?.className).not.toContain("bottom-0");
  });

  it("shows only Recruits and Override Earned for agents (no dead Direct/Network Enrolled KPIs)", () => {
    const member = makeMember({
      role: "agent",
      recruited_count: 7,
      earned_override: 3500,
    });
    render(
      <MemberDetailDrawer member={member} open={true} onOpenChange={() => {}} />
    );
    expect(screen.getByText("Recruits")).toBeTruthy();
    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getByText("Override Earned")).toBeTruthy();
    // The removed dead KPIs must NOT appear.
    expect(screen.queryByText("Direct Enrolled")).toBeNull();
    expect(screen.queryByText("Network Enrolled")).toBeNull();
  });

  it("does not show a fabricated 'Enrolled' KPI for partners (no students_count*0.3)", () => {
    const member = makeMember({
      role: "social_media_partner",
      students_count: 10,
      earned_referral: 2000,
      earned_master_override: 500,
    });
    render(
      <MemberDetailDrawer member={member} open={true} onOpenChange={() => {}} />
    );
    expect(screen.getByText("Referred")).toBeTruthy();
    expect(screen.getByText("10")).toBeTruthy();
    expect(screen.getByText("Earned (Referral)")).toBeTruthy();
    expect(screen.getByText("Earned (Master)")).toBeTruthy();
    // The fabricated "Enrolled" KPI (which would show 3 = round(10*0.3)) must be gone.
    expect(screen.queryByText("Enrolled")).toBeNull();
    // And the fabricated value 3 must not appear anywhere as a KPI value.
    expect(screen.queryAllByText("3").length).toBe(0);
  });

  it("shows an error state with a retry button when the breakdown RPC fails", async () => {
    rpcResult = { data: null, error: new Error("RPC failed") };
    const member = makeMember();
    render(
      <MemberDetailDrawer member={member} open={true} onOpenChange={() => {}} />
    );
    await waitFor(() => {
      expect(screen.getByText("Failed to load commission data")).toBeTruthy();
    });
    expect(screen.getByText("Retry")).toBeTruthy();
  });

  it("retries the breakdown fetch when Retry is clicked", async () => {
    rpcResult = { data: null, error: new Error("RPC failed") };
    const member = makeMember();
    const user = userEvent.setup();
    render(
      <MemberDetailDrawer member={member} open={true} onOpenChange={() => {}} />
    );
    await waitFor(() => {
      expect(screen.getByText("Retry")).toBeTruthy();
    });
    const initialCalls = rpcCalls.length;
    // Fix the RPC so the retry succeeds.
    rpcResult = {
      data: { totalEarned: 100, paid: 0, pending: 0, byType: {}, rateChanges: [] },
      error: null,
    };
    await user.click(screen.getByText("Retry"));
    await waitFor(() => {
      expect(rpcCalls.length).toBeGreaterThan(initialCalls);
    });
  });

  it("prevents a stale breakdown from overwriting the current member (cancellation guard)", async () => {
    // Member A: slow RPC (100ms).
    rpcDelays = [100];
    rpcResult = {
      data: {
        totalEarned: 999,
        paid: 0,
        pending: 0,
        byType: { partner_referral: 999 },
        rateChanges: [],
      },
      error: null,
    };
    const memberA = makeMember({ requester_id: "user-A", full_name: "Member A" });
    const { rerender } = render(
      <MemberDetailDrawer member={memberA} open={true} onOpenChange={() => {}} />
    );

    // Member B: fast RPC (0ms), switches before A's slow response resolves.
    rpcDelays = [0];
    rpcResult = {
      data: {
        totalEarned: 111,
        paid: 0,
        pending: 0,
        byType: { team: 111 },
        rateChanges: [],
      },
      error: null,
    };
    const memberB = makeMember({ requester_id: "user-B", full_name: "Member B" });
    rerender(
      <MemberDetailDrawer member={memberB} open={true} onOpenChange={() => {}} />
    );

    // Wait long enough for both to resolve.
    await waitFor(
      () => {
        // B's byType should be visible (the fast response).
        expect(screen.getByText("team")).toBeTruthy();
      },
      { timeout: 500 }
    );
    // A's stale byType ("partner_referral" with 999) must NOT have overwritten B.
    expect(screen.queryByText("partner_referral")).toBeNull();
  });

  it("preserves team member KPIs (Assigned / Enrolled / Commission)", () => {
    const member = makeMember({
      role: "team_member",
      assigned_cases: 12,
      enrolled_cases: 8,
      team_reward_total: 4000,
    });
    render(
      <MemberDetailDrawer member={member} open={true} onOpenChange={() => {}} />
    );
    expect(screen.getByText("Assigned Cases")).toBeTruthy();
    expect(screen.getByText("Enrolled")).toBeTruthy();
    expect(screen.getByText("Commission / Enrolled")).toBeTruthy();
  });
});
