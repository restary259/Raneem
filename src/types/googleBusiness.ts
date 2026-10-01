/**
 * Types for the DARB office -> Google Business permission foundation (Phase 1).
 * These mirror the columns exposed by the Phase 1 migration's read RPCs.
 */

export type GoogleConnectionStatus =
  "not_connected" | "pending" | "connected" | "error" | "revoked";

export type GoogleVerificationStatus =
  "unverified" | "pending" | "verified" | "failed";

export type GoogleOperatorRole = "PRIMARY" | "SIDE_MANAGER";

/** Phase 3 mapping lifecycle. */
export type GoogleMappingStatus =
  | "UNMAPPED"
  | "PENDING_CONFIRMATION"
  | "MAPPED"
  | "DISCONNECTED"
  | "MAPPING_ERROR";

/** Phase 3 sync health, derived from the mapping + connection state. */
export type GoogleSyncHealth =
  "Healthy" | "Syncing" | "Stale" | "Error" | "Unavailable";

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

/** Phase 3: a discovered Google location (cache row + DARB mapping state). */
export type GoogleBusinessLocationRow = {
  google_location_id: string;
  google_location_resource_name: string;
  google_account_id: string;
  location_name: string | null;
  primary_category: string | null;
  address_json: {
    address_line_1?: string | null;
    address_line_2?: string | null;
    city?: string | null;
    postal_code?: string | null;
    country?: string | null;
  } | null;
  phone: string | null;
  website_url: string | null;
  place_id: string | null;
  maps_url: string | null;
  verification_state: string | null;
  location_state: string | null;
  last_seen_at: string | null;
  mapped_office_id: string | null;
  mapped_office_name: string | null;
};

/** Phase 3: full office mapping detail from get_office_google_mapping(). */
export type OfficeGoogleMappingRow = {
  office_id: string;
  mapping_status: GoogleMappingStatus;
  connection_status: GoogleConnectionStatus;
  verification_status: GoogleVerificationStatus;
  google_account_id: string | null;
  google_location_id: string | null;
  google_location_resource_name: string | null;
  google_location_name: string | null;
  google_primary_category: string | null;
  google_address_line_1: string | null;
  google_address_line_2: string | null;
  google_city: string | null;
  google_postal_code: string | null;
  google_country: string | null;
  google_phone: string | null;
  google_website: string | null;
  google_place_id: string | null;
  google_maps_url: string | null;
  google_store_code: string | null;
  google_status: string | null;
  google_verification_state: string | null;
  mapped_by: string | null;
  mapped_at: string | null;
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
  /** Phase 4: false when the assigned operator is no longer a live team member. */
  primary_is_active: boolean;
  side_manager_is_active: boolean;
};

/** Phase 4: one office a Primary / Side Manager may operate (from list_my_google_offices). */
export type MyGoogleOfficeRow = {
  office_id: string;
  office_name: string | null;
  operator_role: GoogleOperatorRole;
  mapping_status: GoogleMappingStatus;
  connection_status: GoogleConnectionStatus;
  google_location_name: string | null;
  google_maps_url: string | null;
  primary_operator_id: string | null;
  primary_operator_name: string | null;
  side_manager_id: string | null;
  side_manager_name: string | null;
  updated_at: string | null;
};

/** Phase 4: a same-office active member eligible for a Google operator role. */
export type OfficeGoogleOperatorCandidate = {
  team_member_id: string;
  full_name: string | null;
  operator_role: GoogleOperatorRole | null;
};

/** Derives the sync-health badge from a mapping row. */
export function googleSyncHealth(
  row: Pick<
    OfficeGoogleMappingRow,
    "mapping_status" | "connection_status" | "last_error_at"
  > | null,
): GoogleSyncHealth {
  if (!row) return "Unavailable";
  if (row.mapping_status === "MAPPED" && row.connection_status === "connected")
    return "Healthy";
  if (
    row.connection_status === "error" ||
    row.mapping_status === "MAPPING_ERROR"
  )
    return "Error";
  if (
    row.mapping_status === "DISCONNECTED" ||
    row.mapping_status === "UNMAPPED"
  )
    return "Unavailable";
  return "Stale";
}

// ---------------------------------------------------------------------------
// Phase 5 — reviews
// ---------------------------------------------------------------------------

/**
 * DARB's own review lifecycle. Kept separate from Google's raw replyState so a
 * change in Google's enum cannot silently redefine the product state.
 */
export type GoogleReviewReplyStatus =
  "UNANSWERED" | "ANSWERED" | "REPLY_PENDING" | "REPLY_REJECTED" | "SYNC_ERROR";

/** A review Google stopped returning is marked, never deleted. */
export type GoogleReviewVisibility =
  "ACTIVE" | "NOT_FOUND" | "REMOVED" | "STALE";

export type GoogleReviewFilter =
  "all" | "unanswered" | "replied" | "pending" | "rejected";

export type GoogleReviewSort =
  "recent" | "oldest" | "rating_desc" | "rating_asc";

/** One row from list_office_google_reviews(). */
export type GoogleBusinessReviewListRow = {
  id: string;
  office_id: string;
  google_review_id: string;
  google_location_id: string;
  reviewer_display_name: string | null;
  reviewer_profile_photo_url: string | null;
  reviewer_is_anonymous: boolean;
  star_rating: number;
  comment: string | null;
  review_create_time: string | null;
  review_update_time: string | null;
  reply_comment: string | null;
  reply_update_time: string | null;
  reply_state: string | null;
  reply_policy_violation: string | null;
  darb_reply_status: GoogleReviewReplyStatus;
  visibility_state: GoogleReviewVisibility;
  google_review_url: string | null;
  last_synced_at: string | null;
  /** Filtered total (not the page size). */
  total_count: number;
};

/** One row from get_office_google_review_summary(). */
export type OfficeGoogleReviewSummaryRow = {
  office_id: string;
  average_rating: number | null;
  total_count: number | null;
  cached_count: number;
  unanswered_count: number;
  rating_1: number;
  rating_2: number;
  rating_3: number;
  rating_4: number;
  rating_5: number;
  review_last_synced_at: string | null;
  review_last_successful_sync_at: string | null;
  review_sync_error_code: string | null;
  review_sync_error_message: string | null;
  mapping_status: GoogleMappingStatus;
  connection_status: GoogleConnectionStatus;
  verification_status: GoogleVerificationStatus;
  google_location_name: string | null;
  google_maps_url: string | null;
};

/** A compact DARB activity entry shown in the review detail drawer. */
export type GoogleReviewActivityEntry = {
  action: string;
  actor_role: GoogleOperatorActorRole;
  actor_user_id: string | null;
  actor_name: string | null;
  created_at: string;
};

/** One row from get_office_google_review(). */
export type OfficeGoogleReviewDetailRow = GoogleBusinessReviewListRow & {
  activity: GoogleReviewActivityEntry[];
};

/** The reviewer label, honouring Google's anonymous flag without inventing a name. */
export function googleReviewerLabel(
  row: Pick<
    GoogleBusinessReviewListRow,
    "reviewer_display_name" | "reviewer_is_anonymous"
  >,
  anonymousLabel: string,
): string {
  if (row.reviewer_is_anonymous || !row.reviewer_display_name) {
    return anonymousLabel;
  }
  return row.reviewer_display_name;
}
