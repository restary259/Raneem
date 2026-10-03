/**
 * Client mirror of the server authorization function
 * `public.authorize_google_office_action` (see the Phase 1 migration).
 *
 * This is for UI affordances only — hiding a control is never the security
 * boundary. Every write RPC re-checks the same rules server-side, so a forged
 * client call is still rejected.
 */

export const GOOGLE_ACTIONS = [
  "GOOGLE_VIEW",
  "GOOGLE_REPLY_REVIEW",
  "GOOGLE_UPDATE_PROFILE",
  "GOOGLE_MANAGE_MEDIA",
  "GOOGLE_MANAGE_POSTS",
  "GOOGLE_VIEW_INSIGHTS",
  "GOOGLE_MANAGE_SUPPORTED_CONTENT",
  "GOOGLE_SYNC_REVIEWS",
  // Phase 6 — profile management
  "GOOGLE_UPDATE_HOURS",
  "GOOGLE_UPDATE_ATTRIBUTES",
  "GOOGLE_SYNC_PROFILE",
  "GOOGLE_REQUEST_HIGH_RISK",
  "GOOGLE_UPDATE_CATEGORY",
  "GOOGLE_UPDATE_ADDRESS",
  "GOOGLE_APPROVE_CHANGE_REQUEST",
  "GOOGLE_ASSIGN_SIDE_MANAGER",
  "GOOGLE_REMOVE_SIDE_MANAGER",
  "GOOGLE_CHANGE_PRIMARY",
  "GOOGLE_CONNECT",
  "GOOGLE_DISCONNECT",
  "GOOGLE_RECONNECT",
  "GOOGLE_DISCOVER_LOCATIONS",
  "GOOGLE_VIEW_LOCATION",
  "GOOGLE_MAP_LOCATION",
  "GOOGLE_REMAP_LOCATION",
  "GOOGLE_UNMAP_LOCATION",
  // Phase 8 — performance + insights
  "GOOGLE_SYNC_PERFORMANCE",
  // Phase 9 — operational syncs and office reads; account-level admin controls
  "GOOGLE_SYNC_MEDIA",
  "GOOGLE_SYNC_POSTS",
  "GOOGLE_MANAGE_CUSTOMER_MEDIA",
  "GOOGLE_SYNC_OFFICE",
  "GOOGLE_VIEW_HEALTH",
  "GOOGLE_VIEW_SYNC_STATUS",
  "GOOGLE_VIEW_EVENTS",
  "GOOGLE_RETRY_EVENT",
  "GOOGLE_MANAGE_NOTIFICATIONS",
] as const;

export type GoogleAction = (typeof GOOGLE_ACTIONS)[number];

export type GoogleOperatorRole = "PRIMARY" | "SIDE_MANAGER";

const PRIMARY_ACTIONS: ReadonlySet<GoogleAction> = new Set([
  "GOOGLE_VIEW",
  "GOOGLE_REPLY_REVIEW",
  "GOOGLE_UPDATE_PROFILE",
  "GOOGLE_MANAGE_MEDIA",
  "GOOGLE_MANAGE_POSTS",
  "GOOGLE_VIEW_INSIGHTS",
  "GOOGLE_MANAGE_SUPPORTED_CONTENT",
  "GOOGLE_SYNC_REVIEWS",
  "GOOGLE_UPDATE_HOURS",
  "GOOGLE_UPDATE_ATTRIBUTES",
  "GOOGLE_SYNC_PROFILE",
  "GOOGLE_REQUEST_HIGH_RISK",
  "GOOGLE_ASSIGN_SIDE_MANAGER",
  "GOOGLE_REMOVE_SIDE_MANAGER",
  "GOOGLE_SYNC_MEDIA",
  "GOOGLE_SYNC_POSTS",
  "GOOGLE_SYNC_OFFICE",
  "GOOGLE_VIEW_HEALTH",
  "GOOGLE_VIEW_SYNC_STATUS",
]);

const SIDE_MANAGER_ACTIONS: ReadonlySet<GoogleAction> = new Set([
  "GOOGLE_VIEW",
  "GOOGLE_REPLY_REVIEW",
  "GOOGLE_UPDATE_PROFILE",
  "GOOGLE_MANAGE_MEDIA",
  "GOOGLE_MANAGE_POSTS",
  "GOOGLE_VIEW_INSIGHTS",
  "GOOGLE_MANAGE_SUPPORTED_CONTENT",
  "GOOGLE_SYNC_REVIEWS",
  "GOOGLE_UPDATE_HOURS",
  "GOOGLE_UPDATE_ATTRIBUTES",
  "GOOGLE_SYNC_PROFILE",
  "GOOGLE_REQUEST_HIGH_RISK",
  "GOOGLE_SYNC_MEDIA",
  "GOOGLE_SYNC_POSTS",
  "GOOGLE_SYNC_OFFICE",
  "GOOGLE_VIEW_HEALTH",
  "GOOGLE_VIEW_SYNC_STATUS",
]);

/**
 * Actions no non-admin operator may ever hold, regardless of role. Mirrors the
 * server's admin-only branch in `authorize_google_office_action`. The Phase 6
 * high-risk actions are here because operators must route those through an
 * Admin-approved change request instead.
 */
const ADMIN_ONLY_ACTIONS: ReadonlySet<GoogleAction> = new Set([
  "GOOGLE_CHANGE_PRIMARY",
  "GOOGLE_CONNECT",
  "GOOGLE_DISCONNECT",
  "GOOGLE_RECONNECT",
  "GOOGLE_DISCOVER_LOCATIONS",
  "GOOGLE_VIEW_LOCATION",
  "GOOGLE_MAP_LOCATION",
  "GOOGLE_REMAP_LOCATION",
  "GOOGLE_UNMAP_LOCATION",
  "GOOGLE_UPDATE_CATEGORY",
  "GOOGLE_UPDATE_ADDRESS",
  "GOOGLE_APPROVE_CHANGE_REQUEST",
  // Phase 9 — account-level Pub/Sub config, customer-media moderation, raw
  // events and retries are Admin-only, mirroring `google_actor_can`.
  "GOOGLE_MANAGE_NOTIFICATIONS",
  "GOOGLE_MANAGE_CUSTOMER_MEDIA",
  "GOOGLE_VIEW_EVENTS",
  "GOOGLE_RETRY_EVENT",
]);

export type GoogleActorContext = {
  isAdmin: boolean;
  /** The caller's live, active membership of the office in question. */
  isOfficeMember: boolean;
  /** The caller's operator role for the office, if any. */
  operatorRole: GoogleOperatorRole | null;
};

/**
 * Mirrors the server rules: admin -> everything; PRIMARY -> operational +
 * delegation; SIDE_MANAGER -> operational only; everyone else -> nothing.
 */
export function canGoogleOfficeAction(
  actor: GoogleActorContext,
  action: GoogleAction,
): boolean {
  if (actor.isAdmin) return true;
  if (!actor.isOfficeMember) return false;

  if (ADMIN_ONLY_ACTIONS.has(action)) return false;

  if (actor.operatorRole === "PRIMARY") return PRIMARY_ACTIONS.has(action);
  if (actor.operatorRole === "SIDE_MANAGER")
    return SIDE_MANAGER_ACTIONS.has(action);
  return false;
}
