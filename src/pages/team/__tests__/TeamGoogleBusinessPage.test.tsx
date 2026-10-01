import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TeamGoogleBusinessPage from "../TeamGoogleBusinessPage";

/**
 * Phase 4 team surface contract:
 *  - only the offices returned by the office-scoped RPC are shown;
 *  - a PRIMARY gets the side-manager delegation control;
 *  - a SIDE_MANAGER gets a read-only view (no delegation control);
 *  - assigning / removing a side manager calls the same server RPCs the admin
 *    surface uses, with the office id the server already scoped.
 */

const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

vi.mock("react-i18next", () => {
  const t = (key: string, fallback?: unknown) => {
    if (typeof fallback === "string") return fallback;
    return key.split(".").pop();
  };
  return { useTranslation: () => ({ t, i18n: { language: "en" } }) };
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

const PRIMARY_OFFICE = {
  office_id: "berlin",
  office_name: "Berlin Office",
  operator_role: "PRIMARY",
  mapping_status: "MAPPED",
  connection_status: "connected",
  google_location_name: "DARB Berlin",
  google_maps_url: "https://maps.google.com/?cid=1",
  primary_operator_id: "sarah",
  primary_operator_name: "Sarah Müller",
  side_manager_id: null,
  side_manager_name: null,
  updated_at: "2026-10-01T00:00:00Z",
};

const SIDE_OFFICE = {
  ...PRIMARY_OFFICE,
  operator_role: "SIDE_MANAGER",
  side_manager_id: "omar",
  side_manager_name: "Omar Hassan",
};

const CANDIDATES = [
  {
    team_member_id: "sarah",
    full_name: "Sarah Müller",
    operator_role: "PRIMARY",
  },
  { team_member_id: "omar", full_name: "Omar Hassan", operator_role: null },
];

function mockRpc(offices: unknown[]) {
  rpcImpl = (fn) => {
    if (fn === "list_my_google_offices") return { data: offices, error: null };
    if (fn === "list_office_google_operator_candidates")
      return { data: CANDIDATES, error: null };
    return { data: null, error: null };
  };
}

describe("TeamGoogleBusinessPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpcCalls.length = 0;
  });

  it("shows an empty state when the caller operates no office", async () => {
    mockRpc([]);
    render(<TeamGoogleBusinessPage />);
    expect(await screen.findByText("emptyTitle")).toBeInTheDocument();
  });

  it("renders the offices returned by list_my_google_offices", async () => {
    mockRpc([PRIMARY_OFFICE]);
    render(<TeamGoogleBusinessPage />);
    expect(await screen.findByText("Berlin Office")).toBeInTheDocument();
    expect(screen.getByText("rolePrimary")).toBeInTheDocument();
  });

  it("lets a PRIMARY assign a side manager via the server RPC", async () => {
    const user = userEvent.setup();
    mockRpc([PRIMARY_OFFICE]);
    render(<TeamGoogleBusinessPage />);
    await screen.findByText("Berlin Office");

    const combo = screen.getByRole("combobox");
    combo.focus();
    await user.keyboard("{Enter}");
    await user.click(
      await screen.findByRole("option", { name: "Omar Hassan" }),
    );

    await user.click(screen.getByRole("button", { name: /addSideManager/i }));

    await waitFor(() => {
      const call = rpcCalls.find((c) => c.fn === "assign_google_side_manager");
      expect(call).toBeTruthy();
      expect(call!.args).toEqual({
        p_office_id: "berlin",
        p_team_member_id: "omar",
      });
    });
  });

  it("never offers the primary as a side-manager candidate", async () => {
    const user = userEvent.setup();
    mockRpc([PRIMARY_OFFICE]);
    render(<TeamGoogleBusinessPage />);
    await screen.findByText("Berlin Office");

    const combo = screen.getByRole("combobox");
    combo.focus();
    await user.keyboard("{Enter}");

    expect(
      screen.queryByRole("option", { name: "Sarah Müller" }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole("option", { name: "Omar Hassan" }),
    ).toBeInTheDocument();
  });

  it("gives a SIDE_MANAGER no delegation control", async () => {
    mockRpc([SIDE_OFFICE]);
    render(<TeamGoogleBusinessPage />);
    await screen.findByText("Berlin Office");

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /addSideManager/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("sideReadOnly")).toBeInTheDocument();
  });

  it("lets a PRIMARY remove an existing side manager", async () => {
    const user = userEvent.setup();
    mockRpc([
      {
        ...PRIMARY_OFFICE,
        side_manager_id: "omar",
        side_manager_name: "Omar Hassan",
      },
    ]);
    render(<TeamGoogleBusinessPage />);
    await screen.findByText("Berlin Office");

    await user.click(
      screen.getByRole("button", { name: /removeSideManager/i }),
    );

    await waitFor(() => {
      const call = rpcCalls.find((c) => c.fn === "remove_google_operator");
      expect(call).toBeTruthy();
      expect(call!.args).toEqual({
        p_office_id: "berlin",
        p_role: "SIDE_MANAGER",
      });
    });
  });
});
