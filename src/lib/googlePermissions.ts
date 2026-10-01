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
  "GOOGLE_ASSIGN_SIDE_MANAGER",
  "GOOGLE_CHANGE_PRIMARY",
  "GOOGLE_CONNECT",
  "GOOGLE_DISCONNECT",
  "GOOGLE_RECONNECT",
  "GOOGLE_DISCOVER_LOCATIONS",
  "GOOGLE_VIEW_LOCATION",
  "GOOGLE_MAP_LOCATION",
  "GOOGLE_REMAP_LOCATION",
  "GOOGLE_UNMAP_LOCATION",
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
  "GOOGLE_ASSIGN_SIDE_MANAGER",
]);

const SIDE_MANAGER_ACTIONS: ReadonlySet<GoogleAction> = new Set([
  "GOOGLE_VIEW",
  "GOOGLE_REPLY_REVIEW",
  "GOOGLE_UPDATE_PROFILE",
  "GOOGLE_MANAGE_MEDIA",
  "GOOGLE_MANAGE_POSTS",
  "GOOGLE_VIEW_INSIGHTS",
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

  if (
    action === "GOOGLE_CHANGE_PRIMARY" ||
    action === "GOOGLE_CONNECT" ||
    action === "GOOGLE_DISCONNECT" ||
    action === "GOOGLE_RECONNECT" ||
    action === "GOOGLE_DISCOVER_LOCATIONS" ||
    action === "GOOGLE_VIEW_LOCATION" ||
    action === "GOOGLE_MAP_LOCATION" ||
    action === "GOOGLE_REMAP_LOCATION" ||
    action === "GOOGLE_UNMAP_LOCATION"
  ) {
    return false;
  }

  if (actor.operatorRole === "PRIMARY") return PRIMARY_ACTIONS.has(action);
  if (actor.operatorRole === "SIDE_MANAGER")
    return SIDE_MANAGER_ACTIONS.has(action);
  return false;
}
