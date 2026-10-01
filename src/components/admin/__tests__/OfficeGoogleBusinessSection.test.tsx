import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OfficeGoogleBusinessSection from "../OfficeGoogleBusinessSection";

/**
 * Office Google Business surface contract (Phase 1 operators + Phase 3 mapping):
 *  - an office with no mapping shows the "not connected" placeholder and a
 *    Find-location control (admin only);
 *  - the operator selectors only ever offer the eligible same-office members
 *    passed by the parent — never the whole team;
 *  - assigning a primary calls the server RPC with the office + member ids;
 *  - a SIDE_MANAGER actor gets no delegation control;
 *  - discovery lists Google locations, never auto-maps, and a location already
 *    mapped to another office cannot be selected;
 *  - confirming a mapping calls the map server function with the selected
 *    account + resource name (the server re-validates);
 *  - a mapped office shows the location and offers change / disconnect;
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

const discoverFn = vi.fn();
const mapFn = vi.fn();
const unmapFn = vi.fn();

vi.mock("@/lib/googleBusinessLocation.functions", () => ({
  discoverGoogleBusinessLocations: (opts: unknown) => discoverFn(opts),
  mapOfficeGoogleLocation: (opts: unknown) => mapFn(opts),
  unmapOfficeGoogleLocation: (opts: unknown) => unmapFn(opts),
}));

vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: unknown) => fn,
}));

// Server-filtered candidates: only active members of THIS office come back.
const eligible = [
  { team_member_id: "sarah", full_name: "Sarah Müller", operator_role: null },
  { team_member_id: "omar", full_name: "Omar Hassan", operator_role: null },
];

const UNMAPPED_ROW = {
  office_id: "berlin",
  mapping_status: "UNMAPPED",
  connection_status: "not_connected",
  verification_status: "unverified",
  google_account_id: null,
  google_location_id: null,
  google_location_resource_name: null,
  google_location_name: null,
  google_primary_category: null,
  google_address_line_1: null,
  google_address_line_2: null,
  google_city: null,
  google_postal_code: null,
  google_country: null,
  google_phone: null,
  google_website: null,
  google_place_id: null,
  google_maps_url: null,
  google_store_code: null,
  google_status: null,
  google_verification_state: null,
  mapped_by: null,
  mapped_at: null,
  last_synced_at: null,
  last_successful_sync_at: null,
  last_error_at: null,
  last_error_code: null,
  last_error_message: null,
  primary_operator_id: null,
  primary_operator_name: null,
  side_manager_id: null,
  side_manager_name: null,
  updated_at: "2026-10-01T00:00:00Z",
};

const MAPPED_ROW = {
  ...UNMAPPED_ROW,
  mapping_status: "MAPPED",
  connection_status: "connected",
  verification_status: "verified",
  google_account_id: "accounts/1",
  google_location_id: "loc-berlin",
  google_location_resource_name: "accounts/1/locations/loc-berlin",
  google_location_name: "DARB Berlin",
  google_city: "Berlin",
  google_maps_url: "https://maps.google.com/?cid=1",
  google_verification_state: "VERIFIED",
  mapped_at: "2026-10-01T12:00:00Z",
};

function renderSection(
  props: Partial<React.ComponentProps<typeof OfficeGoogleBusinessSection>> = {},
) {
  return render(
    <OfficeGoogleBusinessSection officeId="berlin" isAdmin {...props} />,
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
    discoverFn.mockResolvedValue({
      status: "connected",
      syncedAt: "2026-10-01T00:00:00Z",
      accounts: [{ name: "accounts/1", accountName: "DARB" }],
      locations: [],
      errorCode: null,
      errorMessage: null,
    });
    mapFn.mockResolvedValue({ ok: true, error: null });
    unmapFn.mockResolvedValue({ ok: true, error: null });
    rpcImpl = (fn) => {
      if (fn === "get_office_google_mapping")
        return { data: [UNMAPPED_ROW], error: null };
      if (fn === "admin_get_google_business_activity")
        return { data: [], error: null };
      if (fn === "list_office_google_operator_candidates")
        return { data: eligible, error: null };
      return { data: null, error: null };
    };
  });

  it("shows the not-connected placeholder with a Find-location control", async () => {
    renderSection();
    expect(await screen.findByText("notConnectedTitle")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /findLocation/i }),
    ).toBeInTheDocument();
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

  it("does not offer mapping to a non-admin team member", async () => {
    renderSection({ isAdmin: false, operatorRole: "PRIMARY" });
    await screen.findByText("notConnectedTitle");
    expect(
      screen.queryByRole("button", { name: /findLocation/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("adminOnlyNote")).toBeInTheDocument();
  });

  it("lists discovered locations and never auto-maps", async () => {
    const user = userEvent.setup();
    discoverFn.mockResolvedValue({
      status: "connected",
      syncedAt: "2026-10-01T00:00:00Z",
      accounts: [{ name: "accounts/1", accountName: "DARB" }],
      locations: [
        {
          resourceName: "accounts/1/locations/loc-berlin",
          locationId: "loc-berlin",
          accountId: "accounts/1",
          title: "DARB Berlin",
          address: "Example Strasse 10, 10115, Berlin, DE",
          phone: "+49 30 1234",
          website: "https://darb.agency",
          category: "Education consultant",
          placeId: "place-1",
          mapsUrl: "https://maps.google.com/?cid=1",
          verificationState: "VERIFIED",
          locationState: "OPEN",
          mappedOfficeId: null,
          mappedOfficeName: null,
        },
      ],
      errorCode: null,
      errorMessage: null,
    });

    renderSection();
    await screen.findByText("notConnectedTitle");
    await user.click(screen.getByRole("button", { name: /findLocation/i }));

    expect(await screen.findByText("DARB Berlin")).toBeInTheDocument();
    expect(mapFn).not.toHaveBeenCalled();
  });

  it("disables a location already mapped to another office", async () => {
    const user = userEvent.setup();
    discoverFn.mockResolvedValue({
      status: "connected",
      syncedAt: "2026-10-01T00:00:00Z",
      accounts: [],
      locations: [
        {
          resourceName: "accounts/1/locations/loc-hamburg",
          locationId: "loc-hamburg",
          accountId: "accounts/1",
          title: "DARB Hamburg",
          address: "Hamburg",
          phone: null,
          website: null,
          category: null,
          placeId: null,
          mapsUrl: null,
          verificationState: null,
          locationState: null,
          mappedOfficeId: "hamburg",
          mappedOfficeName: "Hamburg",
        },
      ],
      errorCode: null,
      errorMessage: null,
    });

    renderSection();
    await screen.findByText("notConnectedTitle");
    await user.click(screen.getByRole("button", { name: /findLocation/i }));

    expect(await screen.findByText("DARB Hamburg")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "select" })).toBeDisabled();
  });

  it("maps the selected location through the server function", async () => {
    const user = userEvent.setup();
    discoverFn.mockResolvedValue({
      status: "connected",
      syncedAt: "2026-10-01T00:00:00Z",
      accounts: [],
      locations: [
        {
          resourceName: "accounts/1/locations/loc-berlin",
          locationId: "loc-berlin",
          accountId: "accounts/1",
          title: "DARB Berlin",
          address: "Example Strasse 10, 10115, Berlin, DE",
          phone: "+49 30 1234",
          website: "https://darb.agency",
          category: "Education consultant",
          placeId: "place-1",
          mapsUrl: null,
          verificationState: "VERIFIED",
          locationState: "OPEN",
          mappedOfficeId: null,
          mappedOfficeName: null,
        },
      ],
      errorCode: null,
      errorMessage: null,
    });

    renderSection();
    await screen.findByText("notConnectedTitle");
    await user.click(screen.getByRole("button", { name: /findLocation/i }));
    await user.click(await screen.findByRole("button", { name: "select" }));
    await user.click(
      await screen.findByRole("button", { name: "selectThisLocation" }),
    );
    await user.click(
      await screen.findByRole("button", { name: "confirmConnection" }),
    );

    await waitFor(() => {
      expect(mapFn).toHaveBeenCalledWith({
        data: {
          officeId: "berlin",
          googleAccountId: "accounts/1",
          googleLocationResourceName: "accounts/1/locations/loc-berlin",
        },
      });
    });
  });

  it("shows a mapped office with change and disconnect controls", async () => {
    rpcImpl = (fn) => {
      if (fn === "get_office_google_mapping")
        return { data: [MAPPED_ROW], error: null };
      if (fn === "admin_get_google_business_activity")
        return { data: [], error: null };
      if (fn === "list_office_google_operator_candidates")
        return { data: eligible, error: null };
      return { data: null, error: null };
    };
    renderSection();
    expect(await screen.findByText("DARB Berlin")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /changeLocation/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /disconnect/i }),
    ).toBeInTheDocument();
  });

  it("unmaps through the server function after confirmation", async () => {
    const user = userEvent.setup();
    rpcImpl = (fn) => {
      if (fn === "get_office_google_mapping")
        return { data: [MAPPED_ROW], error: null };
      if (fn === "admin_get_google_business_activity")
        return { data: [], error: null };
      if (fn === "list_office_google_operator_candidates")
        return { data: eligible, error: null };
      return { data: null, error: null };
    };
    renderSection();
    await screen.findByText("DARB Berlin");
    await user.click(screen.getByRole("button", { name: /^disconnect$/i }));
    await user.click(
      await screen.findByRole("button", { name: "disconnectConfirm" }),
    );

    await waitFor(() => {
      expect(unmapFn).toHaveBeenCalledWith({ data: { officeId: "berlin" } });
    });
  });

  it("renders localized audit action labels", async () => {
    rpcImpl = (fn) => {
      if (fn === "get_office_google_mapping")
        return { data: [UNMAPPED_ROW], error: null };
      if (fn === "admin_get_google_business_activity") {
        return {
          data: [
            {
              id: "a1",
              office_id: "berlin",
              google_location_id: null,
              actor_user_id: "admin",
              actor_role: "admin",
              action: "GOOGLE_LOCATION_MAPPED",
              resource_type: "office_google_profile",
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
      await screen.findByText("GOOGLE_LOCATION_MAPPED"),
    ).toBeInTheDocument();
  });
});
