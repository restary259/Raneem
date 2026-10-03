import { supabase } from "@/integrations/supabase/client";

// Must stay bound: supabase.rpc reads `this.rest`, so a detached reference
// (e.g. `const r = supabase.rpc; r(...)`) throws.
const rpc = ((fn: string, args?: Record<string, unknown>) =>
  (
    supabase.rpc as unknown as (
      fn: string,
      args?: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>
  ).call(supabase, fn, args)) as <T>(
  fn: string,
  args?: Record<string, unknown>,
) => Promise<{ data: T | null; error: { message: string } | null }>;

/**
 * Resolves a public office slug to its id. Read-only lookup used by the office
 * workspace routes; the caller still verifies the id appears in its own office
 * list, so this is a resolver, not an authorization boundary.
 */
export function resolveOfficeSlug(slug: string) {
  return rpc<string | null>("resolve_office_slug", { p_slug: slug });
}

export type OfficeWorkspaceContext = {
  office: {
    id: string;
    slug: string;
    name: string;
    name_ar: string;
    name_he: string;
    country: string;
    city: string;
    address_line_1: string | null;
    phone: string | null;
    email: string | null;
    map_url: string | null;
    timezone: string;
    is_active: boolean;
    booking_enabled: boolean;
  };
  membership: {
    is_admin: boolean;
    is_member: boolean;
    member_count: number;
  };
  team: {
    primary_id: string | null;
    primary_name: string | null;
    side_id: string | null;
    side_name: string | null;
  };
  google: {
    connected: boolean;
    mapping_status?: string;
    connection_status?: string;
    google_location_name?: string | null;
    google_maps_url?: string | null;
  };
};

/**
 * The single server-side context/authorization check for an office workspace.
 * Throws (`Forbidden`) when the caller is neither an admin nor an active member.
 */
export function getOfficeWorkspace(officeId: string) {
  return rpc<OfficeWorkspaceContext | null>("get_office_workspace", {
    p_office_id: officeId,
  });
}

export type MyOfficeRow = {
  office_id: string;
  slug: string;
  name: string;
  city: string;
  country: string;
  timezone: string;
  is_active: boolean;
  booking_enabled: boolean;
  map_url: string | null;
  primary_name: string | null;
  member_count: number;
  google_connected: boolean;
};

/** Offices the caller may open a workspace for (admin: all, member: theirs). */
export function listMyOffices() {
  return rpc<MyOfficeRow[]>("list_my_offices");
}
