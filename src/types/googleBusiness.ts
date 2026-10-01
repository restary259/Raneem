/**
 * Types for the DARB office -> Google Business permission foundation (Phase 1).
 * These mirror the columns exposed by the Phase 1 migration's read RPCs.
 */

export type GoogleConnectionStatus =
  "not_connected" | "pending" | "connected" | "error" | "revoked";

export type GoogleVerificationStatus =
  "unverified" | "pending" | "verified" | "failed";

export type GoogleOperatorRole = "PRIMARY" | "SIDE_MANAGER";

export type GoogleOperatorActorRole = "admin" | GoogleOperatorRole | "system";

export type OfficeGoogleProfileRow = {
  id: string;
  office_id: string;
  google_account_id: string | null;
  google_location_id: string | null;
  google_location_resource_name: string | null;
  google_place_id: string | null;
  google_maps_url: string | null;
  connection_status: GoogleConnectionStatus;
  verification_status: GoogleVerificationStatus;
  last_synced_at: string | null;
  last_successful_sync_at: string | null;
  last_error_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  primary_operator_id: string | null;
  primary_operator_name: string | null;
  side_manager_id: string | null;
  side_manager_name: string | null;
  updated_at: string;
};

export type GoogleBusinessConnectionRow = {
  id: string;
  provider: "google_business_profile";
  google_email: string | null;
  google_account_id: string | null;
  connection_status: GoogleConnectionStatus;
  connected_by: string | null;
  connected_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GoogleBusinessActivityRow = {
  id: string;
  office_id: string | null;
  google_location_id: string | null;
  actor_user_id: string | null;
  actor_role: GoogleOperatorActorRole;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  created_at: string;
};

/** Same-office, active member eligible to be a Google operator. */
export type GoogleOperatorCandidate = {
  id: string;
  full_name: string;
};
