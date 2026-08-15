import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

// ── Mock i18n: return the fallback string so the rendered text is stable ──
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_k: string, fallback?: any) =>
      typeof fallback === "string" ? fallback : (fallback?.defaultValue ?? _k),
  }),
}));

// ── Mock the supabase client so the hook's RPCs return controlled data ────
const mockRpc = vi.fn().mockImplementation((name: string) => {
  let data: unknown = null;
  switch (name) {
    case "get_commission_hub_overview":
      data = {
        team_members_total: 3,
        partners_total: 5,
        partners_custom: 2,
        partners_at_zero: 1,
        ambassadors_total: 1,
        agents_total: 4,
        agents_custom: 1,
        students_total: 50,
        student_overrides: 0,
        independent_partners: 2,
        master_partners: 1,
        global_rates: {
          partner: 1000, ambassador: 800, team: 100, master_share: 200,
          agent: 500, agent_self_referral: 300, referral_discount: 500,
          student_friend_discount: 500, student_friend_reward: 200,
          student_family_discount: 700, student_family_reward: 300,
        },
        recent_changes: [],
      };
      break;
    case "get_independent_accounts":
      data = [];
      break;
    case "get_agent_list":
      data = [
        { id: "agent-1", name: "Agent One", email: "a1@test", override: 600, global_rate: 500, students_referred: 3, earned: 1800 },
      ];
      break;
    case "get_student_referral_config":
      data = {
        global: { friend_discount: 500, friend_reward: 200, family_discount: 700, family_reward: 300 },
        overrides: [],
      };
      break;
    case "admin_set_commission":
      data = { ok: true };
      break;
    default:
      data = null;
  }
  return Promise.resolve({ data, error: null });
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: () => ({
      select: () => ({ eq: () => ({}) }),
    }),
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import AdminCommissionHubPage from "@/pages/admin/AdminCommissionHubPage";

const renderPage = () => render(<AdminCommissionHubPage />);

describe("AdminCommissionHubPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders KPIs from the overview RPC", async () => {
    renderPage();
    // The Overview tab is default — wait for the partners count (5) to appear.
    await waitFor(() => {
      expect(screen.getByText("5")).toBeInTheDocument();
    });
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders the additive-model banner", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Commission Hub/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/ADDITIVE/i)).toBeInTheDocument();
  });

  it("calls admin_set_commission with the right args when a global rate is saved", async () => {
    const user = userEvent.setup();
    renderPage();
    const ratesTab = await screen.findByRole("tab", { name: /Global rates/i });
    await user.click(ratesTab);

    // Target the agent rate row by its data-testid, then scope the input +
    // Save button inside that row. This survives reordering of the rate list.
    const agentRow = await screen.findByTestId("rate-row-agent_commission_rate");
    const agentInput = agentRow.querySelector('input[type="number"]') as HTMLInputElement;
    await user.clear(agentInput);
    await user.type(agentInput, "650");

    const saveButton = agentRow.querySelector('button') as HTMLButtonElement;
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith(
        "admin_set_commission",
        expect.objectContaining({
          p_entity_type: "global",
          p_rate_kind: "agent_commission_rate",
          p_amount: 650,
        }),
      );
    });
  });
});
