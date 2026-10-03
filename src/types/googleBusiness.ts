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
  office_slug: string | null;
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

// ---------------------------------------------------------------------------
// Phase 6 — profile management
// ---------------------------------------------------------------------------

export type GoogleChangeRequestField =
  "ADDRESS" | "PRIMARY_CATEGORY" | "LOCATION_MAPPING";

export type GoogleChangeRequestStatus =
  "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "FAILED";

/**
 * Field risk classification. HIGH-risk fields cannot be published directly by a
 * Primary or Side Manager — they go through an Admin-approved change request.
 * Mirrors `google_profile_high_risk_fields()` on the server.
 */
export type GoogleProfileFieldRisk = "LOW" | "MEDIUM" | "HIGH";

export const GOOGLE_PROFILE_HIGH_RISK_FIELDS: readonly string[] = [
  "primary_category",
  "address_line_1",
  "address_line_2",
  "postal_code",
  "city",
  "region",
  "country",
  "latitude",
  "longitude",
];

export const GOOGLE_PROFILE_MEDIUM_RISK_FIELDS: readonly string[] = [
  "regular_hours",
  "special_hours",
  "attributes",
  "additional_categories",
];

/** Risk of a single field, used to pick confirmation UX and routing. */
export function googleProfileFieldRisk(field: string): GoogleProfileFieldRisk {
  if (GOOGLE_PROFILE_HIGH_RISK_FIELDS.includes(field)) return "HIGH";
  if (GOOGLE_PROFILE_MEDIUM_RISK_FIELDS.includes(field)) return "MEDIUM";
  return "LOW";
}

/** True when any field in the change set requires Admin approval. */
export function googleProfileChangeNeedsApproval(
  fields: readonly string[],
): boolean {
  return fields.some((f) => googleProfileFieldRisk(f) === "HIGH");
}

/** One row from get_office_google_profile(). */
export type OfficeGoogleProfileDetailRow = {
  office_id: string;
  office_name: string | null;
  mapping_status: GoogleMappingStatus;
  connection_status: GoogleConnectionStatus;
  verification_status: GoogleVerificationStatus;
  google_account_id: string | null;
  google_location_id: string | null;
  google_location_resource_name: string | null;
  google_location_name: string | null;
  google_place_id: string | null;
  google_maps_url: string | null;
  google_state: string | null;
  business_name: string | null;
  business_description: string | null;
  primary_category: string | null;
  additional_categories: string[];
  phone_primary: string | null;
  phone_additional: string[];
  website_url: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  postal_code: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  regular_hours: Record<
    string,
    { open: string; close: string }[] | null
  > | null;
  special_hours: {
    date: string;
    closed: boolean;
    periods?: { open: string; close: string }[];
  }[];
  attributes: string[];
  profile_version: number;
  profile_updated_at: string | null;
  profile_last_synced_at: string | null;
  profile_last_successful_sync_at: string | null;
  profile_sync_error_code: string | null;
  profile_sync_error_message: string | null;
  primary_operator_id: string | null;
  primary_operator_name: string | null;
  side_manager_id: string | null;
  side_manager_name: string | null;
  pending_change_count: number;
};

/** One row from list_google_profile_change_requests(). */
export type GoogleProfileChangeRequestRow = {
  id: string;
  office_id: string;
  field: GoogleChangeRequestField;
  current_value: Record<string, unknown> | null;
  requested_value: Record<string, unknown>;
  status: GoogleChangeRequestStatus;
  reason: string | null;
  requested_by: string | null;
  requested_by_name: string | null;
  requested_by_role: GoogleOperatorActorRole | null;
  decided_by: string | null;
  decided_by_name: string | null;
  decided_at: string | null;
  decision_note: string | null;
  applied_at: string | null;
  apply_error_code: string | null;
  apply_error_message: string | null;
  created_at: string;
};

/** A single field-level difference shown in the change review. */
export type GoogleProfileDiffEntry = {
  field: string;
  before: string | null;
  after: string | null;
};

/** Deterministic profile health — never an invented score. */
export type GoogleProfileHealth =
  "Healthy" | "NeedsAttention" | "Disconnected" | "Unavailable";

export function googleProfileHealth(
  row: Pick<
    OfficeGoogleProfileDetailRow,
    | "mapping_status"
    | "connection_status"
    | "profile_sync_error_code"
    | "pending_change_count"
    | "profile_last_successful_sync_at"
  > | null,
): GoogleProfileHealth {
  if (!row) return "Unavailable";
  if (row.connection_status !== "connected") return "Disconnected";
  if (row.mapping_status !== "MAPPED") return "Unavailable";
  if (row.profile_sync_error_code) return "NeedsAttention";
  if (row.pending_change_count > 0) return "NeedsAttention";
  return "Healthy";
}

// ---------------------------------------------------------------------------
// Phase 8 — Google Business Performance + Insights
//
// Mirrors the Phase 8 read RPCs. Every metric keeps Google's own vocabulary:
// a "profile view" is never collapsed into an ambiguous "views" number, and a
// threshold is never shown as an exact value.
// ---------------------------------------------------------------------------

/** Google's documented daily metrics that DARB requests and stores. */
export const GOOGLE_PERFORMANCE_METRICS = [
  "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
  "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
  "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
  "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
  "BUSINESS_CONVERSATIONS",
  "BUSINESS_DIRECTION_REQUESTS",
  "CALL_CLICKS",
  "WEBSITE_CLICKS",
  "BUSINESS_BOOKINGS",
  "BUSINESS_FOOD_MENU_CLICKS",
] as const;

export type GooglePerformanceMetric =
  (typeof GOOGLE_PERFORMANCE_METRICS)[number];

/**
 * A metric's availability. VALUE and ZERO are both measurements; NOT_AVAILABLE
 * means Google did not report the metric for this office/period at all, so the
 * UI must not render it as 0.
 */
export type GoogleMetricStatus = "VALUE" | "ZERO" | "NOT_AVAILABLE";

export type GoogleMetricTotals = Partial<
  Record<GooglePerformanceMetric, number>
>;
export type GoogleMetricStatusMap = Partial<
  Record<GooglePerformanceMetric, GoogleMetricStatus>
>;

export type GooglePerformanceContext = {
  office_id: string;
  office_name: string | null;
  timezone: string;
  mapping_status: string | null;
  connection_status: string | null;
  verification_status: string | null;
  google_location_name: string | null;
  google_maps_url: string | null;
  data_through: string | null;
  performance_last_synced_at: string | null;
  performance_last_successful_sync_at: string | null;
  performance_sync_error_code: string | null;
  performance_sync_error_message: string | null;
  has_any_data: boolean;
  has_keywords: boolean;
};

export type GooglePerformanceSummary = GooglePerformanceContext & {
  current_totals: GoogleMetricTotals;
  previous_totals: GoogleMetricTotals;
  metric_status: GoogleMetricStatusMap;
};

export type GooglePerformanceSeriesPoint = {
  metric: GooglePerformanceMetric;
  metric_date: string;
  metric_value: number;
  data_state: "VALUE" | "ZERO" | "NO_DATA";
};

export type GoogleSearchKeywordRow = {
  id: string;
  month: string;
  search_keyword: string;
  insights_value: number;
  insights_value_type: "VALUE" | "THRESHOLD";
  total_count: number;
};

export type GooglePerformanceSyncJob = {
  id: string;
  sync_type: "METRICS" | "KEYWORDS" | "BACKFILL";
  start_date: string | null;
  end_date: string | null;
  status: "PENDING" | "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED";
  started_at: string | null;
  completed_at: string | null;
  records_processed: number;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
};

/** Phase 8: one office the caller may view Insights for (selector source). */
export type GooglePerformanceOfficeRow = {
  office_id: string;
  office_slug: string | null;
  office_name: string | null;
  operator_role: "PRIMARY" | "SIDE_MANAGER" | "ADMIN";
  mapping_status: string | null;
  connection_status: string | null;
  google_location_name: string | null;
  google_maps_url: string | null;
  timezone: string;
  performance_last_synced_at: string | null;
  performance_data_through: string | null;
};

export type GooglePerformanceAggregateRow = {
  office_id: string;
  office_name: string | null;
  current_totals: GoogleMetricTotals;
  previous_totals: GoogleMetricTotals;
  metric_status: GoogleMetricStatusMap;
  data_through: string | null;
  last_synced_at: string | null;
};

/** Whether a metric should be shown at all: only VALUE/ZERO are measurements. */
export function isMetricMeasured(
  status: GoogleMetricStatus | undefined,
): boolean {
  return status === "VALUE" || status === "ZERO";
}

// ---------------------------------------------------------------------------
// Phase 7 — photos (media) + posts
// ---------------------------------------------------------------------------

/** BUSINESS = DARB/business uploaded; CUSTOMER = contributed by a customer. */
export type GoogleMediaOrigin = "BUSINESS" | "CUSTOMER";

/**
 * Google's processing/lifecycle state plus DARB's own terminal states.
 * SUBMITTED -> PROCESSING -> PUBLISHED is Google's async path; NOT_FOUND means
 * Google no longer returns the item.
 */
export type GoogleMediaState =
  | "SUBMITTED"
  | "PROCESSING"
  | "PUBLISHED"
  | "FAILED"
  | "REJECTED"
  | "NOT_FOUND"
  | "DELETED";

export type GoogleMediaFilter =
  "all" | "cover" | "logo" | "exterior" | "interior" | "team" | "other";

/** One row from list_office_google_media(). */
export type GoogleBusinessMediaListRow = {
  id: string;
  office_id: string;
  google_media_id: string;
  google_location_id: string;
  media_format: string | null;
  media_category: string | null;
  darb_category: string | null;
  media_origin: GoogleMediaOrigin;
  google_source_url: string | null;
  google_thumbnail_url: string | null;
  google_full_url: string | null;
  description: string | null;
  width: number | null;
  height: number | null;
  attribution: string | null;
  media_state: GoogleMediaState;
  created_at: string;
  last_synced_at: string | null;
  /** Filtered total (not the page size). */
  total_count: number;
};

/** One row from get_office_google_media_summary(). */
export type OfficeGoogleMediaSummaryRow = {
  office_id: string;
  business_count: number;
  customer_count: number;
  cover_count: number;
  logo_count: number;
  exterior_count: number;
  interior_count: number;
  team_count: number;
  other_count: number;
  media_last_synced_at: string | null;
  media_last_successful_sync_at: string | null;
  media_sync_error_code: string | null;
  media_sync_error_message: string | null;
  mapping_status: GoogleMappingStatus;
  connection_status: GoogleConnectionStatus;
  google_location_name: string | null;
  google_maps_url: string | null;
};

/** DARB's post lifecycle. Never merged with Google's raw state. */
export type GooglePostStatus =
  | "DRAFT"
  | "PUBLISHING"
  | "PUBLISHED"
  | "UPDATE_PENDING"
  | "DELETE_PENDING"
  | "DELETED"
  | "DELETED_EXTERNALLY"
  | "FAILED";

export type GooglePostFilter =
  "all" | "published" | "drafts" | "failed" | "deleted";

/** One row from list_office_google_posts(). */
export type GoogleBusinessPostListRow = {
  id: string;
  office_id: string;
  google_post_id: string | null;
  google_location_id: string | null;
  topic_type: string;
  language_code: string;
  summary: string | null;
  cta_type: string | null;
  cta_url: string | null;
  event_title: string | null;
  event_start: string | null;
  event_end: string | null;
  offer_coupon_code: string | null;
  offer_url: string | null;
  offer_terms: string | null;
  media_ids: string[];
  media_urls: string[];
  google_state: string | null;
  search_url: string | null;
  status: GooglePostStatus;
  last_error_code: string | null;
  last_error_message: string | null;
  published_at: string | null;
  deleted_at: string | null;
  version: number;
  google_update_time: string | null;
  created_by: string | null;
  created_by_name: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  last_synced_at: string | null;
  total_count: number;
};

/** One row from get_office_google_posts_summary(). */
export type OfficeGooglePostsSummaryRow = {
  office_id: string;
  draft_count: number;
  published_count: number;
  failed_count: number;
  deleted_count: number;
  posts_last_synced_at: string | null;
  posts_last_successful_sync_at: string | null;
  posts_sync_error_code: string | null;
  posts_sync_error_message: string | null;
  mapping_status: GoogleMappingStatus;
  connection_status: GoogleConnectionStatus;
  google_location_name: string | null;
  google_maps_url: string | null;
};

/** The four post shapes DARB offers. Product posts are deliberately absent. */
export type GooglePostKind = "UPDATE" | "EVENT" | "OFFER" | "CTA";

/**
 * The DARB post kind is a product concept; Google only knows topicType. A CTA
 * post is a STANDARD post that carries a callToAction, so the mapping is not
 * one-to-one and must not be conflated.
 */
export function googlePostKind(row: {
  topic_type: string;
  cta_type: string | null;
}): GooglePostKind {
  if (row.topic_type === "EVENT") return "EVENT";
  if (row.topic_type === "OFFER") return "OFFER";
  if (row.cta_type) return "CTA";
  return "UPDATE";
}

/** True when DARB may delete/edit the row (never an externally-deleted post). */
export function isGooglePostEditable(status: GooglePostStatus): boolean {
  return (
    status !== "DELETED" &&
    status !== "DELETED_EXTERNALLY" &&
    status !== "DELETE_PENDING"
  );
}

/** True when the row is read-only customer media. */
export function isCustomerMediaRow(row: {
  media_origin: GoogleMediaOrigin;
}): boolean {
  return row.media_origin === "CUSTOMER";
}
