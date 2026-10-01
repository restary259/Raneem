import { supabase } from "@/integrations/supabase/client";
import type {
  GoogleBusinessActivityRow,
  GoogleBusinessLocationRow,
  GoogleOperatorRole,
  MyGoogleOfficeRow,
  OfficeGoogleMappingRow,
  OfficeGoogleOperatorCandidate,
  OfficeGoogleProfileRow,
} from "@/types/googleBusiness";

type RpcError = { message?: string } | null;
type RpcResponse<T> = { data: T | null; error: RpcError };

/**
 * The generated Supabase types predate the Phase 1 Google RPCs, so the untyped
 * call surface is narrowed here once instead of scattering casts across the UI.
 */
type UntypedRpc = <T>(
  fn: string,
  args?: Record<string, unknown>,
) => Promise<RpcResponse<T>>;
// Must stay bound: supabase.rpc reads `this.rest`, so a detached reference
// throws "undefined is not an object (evaluating 'this.rest')".
const rpc = ((fn: string, args?: Record<string, unknown>) =>
  (supabase.rpc as unknown as (this: typeof supabase, f: string, a?: Record<string, unknown>) => unknown).call(
    supabase,
    fn,
    args,
  )) as unknown as UntypedRpc;

export function listOfficeGoogleProfiles() {
  return rpc<OfficeGoogleProfileRow[]>("list_office_google_profiles");
}

export function getGoogleBusinessActivity(officeId: string, limit = 10) {
  return rpc<GoogleBusinessActivityRow[]>(
    "admin_get_google_business_activity",
    {
      p_office_id: officeId,
      p_limit: limit,
    },
  );
}

export function adminAssignGooglePrimary(
  officeId: string,
  teamMemberId: string,
) {
  return rpc("admin_assign_google_primary", {
    p_office_id: officeId,
    p_team_member_id: teamMemberId,
  });
}

export function assignGoogleSideManager(
  officeId: string,
  teamMemberId: string,
) {
  return rpc("assign_google_side_manager", {
    p_office_id: officeId,
    p_team_member_id: teamMemberId,
  });
}

export function removeGoogleOperator(
  officeId: string,
  role: GoogleOperatorRole,
) {
  return rpc("remove_google_operator", { p_office_id: officeId, p_role: role });
}

// ---------------------------------------------------------------------------
// Phase 3 — location discovery + office mapping
// ---------------------------------------------------------------------------

/** Full mapping detail for one office (admin or an active member of it). */
export function getOfficeGoogleMapping(officeId: string) {
  return rpc<OfficeGoogleMappingRow[]>("get_office_google_mapping", {
    p_office_id: officeId,
  });
}

/** Admin-only: the cached Google locations, with their DARB mapping state. */
export function listGoogleBusinessLocations() {
  return rpc<GoogleBusinessLocationRow[]>("admin_list_google_locations");
}

// ---------------------------------------------------------------------------
// Phase 4 — Primary + Side Manager delegation
// ---------------------------------------------------------------------------

/** The offices the signed-in Primary / Side Manager may operate. */
export function listMyGoogleOffices() {
  return rpc<MyGoogleOfficeRow[]>("list_my_google_offices");
}

/**
 * Server-filtered operator candidates for an office. Only active team members
 * of that office are returned; the browser never assembles this list itself.
 */
export function listOfficeGoogleOperatorCandidates(officeId: string) {
  return rpc<OfficeGoogleOperatorCandidate[]>(
    "list_office_google_operator_candidates",
    { p_office_id: officeId },
  );
}
