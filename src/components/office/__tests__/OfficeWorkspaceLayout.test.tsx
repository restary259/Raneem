import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OfficeWorkspaceLayout } from "../OfficeWorkspaceLayout";
import type { OfficeWorkspaceContext } from "@/lib/officeApi";

const context: OfficeWorkspaceContext = {
  office: {
    id: "office-1",
    slug: "tel-aviv",
    name: "Tel Aviv",
    name_ar: "تل أبيب",
    name_he: "תל אביב",
    country: "IL",
    city: "Tel Aviv",
    address_line_1: null,
    phone: null,
    email: null,
    map_url: null,
    timezone: "Asia/Jerusalem",
    is_active: true,
    booking_enabled: true,
  },
  membership: { is_admin: false, is_member: true, member_count: 3 },
  team: {
    primary_id: null,
    primary_name: null,
    side_id: null,
    side_name: null,
  },
  google: { connected: true, mapping_status: "MAPPED" },
};

vi.mock("@/lib/officeApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/officeApi")>();
  return {
    ...actual,
    resolveOfficeSlug: () => Promise.resolve({ data: "office-1", error: null }),
    getOfficeWorkspace: () => Promise.resolve({ data: context, error: null }),
  };
});

let access: boolean | null = null;
let lastActive: boolean | undefined;
vi.mock("@/hooks/useGoogleBusinessAccess", () => ({
  useGoogleBusinessAccess: (active?: boolean) => {
    lastActive = active;
    return access;
  },
}));

vi.mock("@/lib/router-compat", () => ({
  Link: ({ to, children }: { to: string; children: React.ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}));

function renderLayout(surface: "team" | "admin" = "team") {
  return render(
    <OfficeWorkspaceLayout surface={surface} officeId="tel-aviv">
      <div>office body</div>
    </OfficeWorkspaceLayout>,
  );
}

describe("OfficeWorkspaceLayout Google gating", () => {
  beforeEach(() => {
    access = null;
    lastActive = undefined;
  });

  it("hides the Google tab for a team member while unresolved", async () => {
    renderLayout("team");
    await waitFor(() =>
      expect(screen.getByText("office body")).toBeInTheDocument(),
    );
    expect(lastActive).toBe(true);
    expect(screen.queryByText("Google Business")).not.toBeInTheDocument();
  });

  it("shows the Google tab once the server confirms an assignment", async () => {
    access = true;
    renderLayout("team");
    await waitFor(() =>
      expect(screen.getByText("Google Business")).toBeInTheDocument(),
    );
  });

  it("keeps the Google tab hidden for an unassigned team member", async () => {
    access = false;
    renderLayout("team");
    await waitFor(() =>
      expect(screen.getByText("office body")).toBeInTheDocument(),
    );
    expect(screen.queryByText("Google Business")).not.toBeInTheDocument();
  });

  it("always shows the Google tab on the admin surface", async () => {
    access = false;
    renderLayout("admin");
    await waitFor(() =>
      expect(screen.getByText("Google Business")).toBeInTheDocument(),
    );
    expect(lastActive).toBe(false);
  });
});
