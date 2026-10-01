import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OfficeGoogleBusinessSection from "../OfficeGoogleBusinessSection";

/**
 * Phase 1 admin surface contract:
 *  - an office with no Google profile shows the "not connected" placeholder and
 *    a Connect control that is disabled (OAuth lands in Phase 2);
 *  - the operator selectors only ever offer the eligible same-office members
 *    passed by the parent — never the whole team;
 *  - assigning a primary calls the server RPC with the office + member ids;
 *  - a SIDE_MANAGER actor gets no delegation control (the server rejects it
 *    anyway; this asserts the UI does not even offer it);
 *  - the audit feed renders localized action labels.
 */

const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

vi.mock("react-i18next", () => {
  const t = (key: string, fallback?: unknown) => {
    if (typeof fallback === "string") return fallback;
    return key.split(".").pop();
  };
  const i18n = { language: "en" };
  return { useTranslation: () => ({ t, i18n }) };
});

type RpcArgs = Record<string, unknown> | undefined;
type RpcResult = { data?: unknown; error?: unknown };
let rpcImpl: (fn: string, args?: RpcArgs) => RpcResult;
const rpcCalls: { fn: string; args: RpcArgs }[] = [];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (fn: string, args?: RpcArgs) => {
      rpcCalls.push({ fn, args });
      return Promise.resolve(rpcImpl(fn, args));
    },
  },
}));

const eligible = [
  { id: "sarah", full_name: "Sarah Müller" },
  { id: "omar", full_name: "Omar Hassan" },
];

function renderSection(
  props: Partial<React.ComponentProps<typeof OfficeGoogleBusinessSection>> = {},
) {
  return render(
    <OfficeGoogleBusinessSection
      officeId="berlin"
      isAdmin
      eligibleMembers={eligible}
      {...props}
    />,
  );
}

async function chooseOption(
  user: ReturnType<typeof userEvent.setup>,
  optionName: string,
) {
  const combo = screen.getAllByRole("combobox")[0];
  combo.focus();
  await user.keyboard("{Enter}");
  await user.click(await screen.findByRole("option", { name: optionName }));
}

describe("OfficeGoogleBusinessSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpcCalls.length = 0;
    rpcImpl = (fn) => {
      if (fn === "list_office_google_profiles")
        return { data: [], error: null };
      if (fn === "admin_get_google_business_activity")
        return { data: [], error: null };
      return { data: null, error: null };
    };
  });

  it("shows the not-connected placeholder with a disabled Connect control", async () => {
    renderSection();
    expect(await screen.findByText("notConnectedTitle")).toBeInTheDocument();
    const connect = screen.getByRole("button", { name: /connect/i });
    expect(connect).toBeDisabled();
  });

  it("offers only the eligible same-office members in the selector", async () => {
    const user = userEvent.setup();
    renderSection();
    await screen.findByText("notConnectedTitle");

    const combo = screen.getAllByRole("combobox")[0];
    combo.focus();
    await user.keyboard("{Enter}");

    expect(
      await screen.findByRole("option", { name: "Sarah Müller" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Omar Hassan" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Daniel Koch" }),
    ).not.toBeInTheDocument();
  });

  it("calls admin_assign_google_primary with the office and chosen member", async () => {
    const user = userEvent.setup();
    renderSection();
    await screen.findByText("notConnectedTitle");

    await chooseOption(user, "Omar Hassan");
    await user.click(screen.getByRole("button", { name: "change" }));

    await waitFor(() => {
      const call = rpcCalls.find((c) => c.fn === "admin_assign_google_primary");
      expect(call).toBeTruthy();
      expect(call!.args).toEqual({
        p_office_id: "berlin",
        p_team_member_id: "omar",
      });
    });
  });

  it("does not offer delegation to a SIDE_MANAGER actor", async () => {
    renderSection({ isAdmin: false, operatorRole: "SIDE_MANAGER" });
    await screen.findByText("notConnectedTitle");
    expect(
      screen.queryByRole("button", { name: "addSideManager" }),
    ).not.toBeInTheDocument();
  });

  it("offers delegation to a PRIMARY actor", async () => {
    renderSection({ isAdmin: false, operatorRole: "PRIMARY" });
    await screen.findByText("notConnectedTitle");
    expect(
      screen.getByRole("button", { name: "addSideManager" }),
    ).toBeInTheDocument();
  });

  it("renders localized audit action labels", async () => {
    rpcImpl = (fn) => {
      if (fn === "list_office_google_profiles")
        return { data: [], error: null };
      if (fn === "admin_get_google_business_activity") {
        return {
          data: [
            {
              id: "a1",
              office_id: "berlin",
              google_location_id: null,
              actor_user_id: "admin",
              actor_role: "admin",
              action: "ADMIN_ASSIGNED_PRIMARY",
              resource_type: "office_google_operator",
              resource_id: "op1",
              before_data: null,
              after_data: null,
              created_at: "2026-10-01T12:00:00Z",
            },
          ],
          error: null,
        };
      }
      return { data: null, error: null };
    };
    renderSection();
    expect(
      await screen.findByText("ADMIN_ASSIGNED_PRIMARY"),
    ).toBeInTheDocument();
  });
});
