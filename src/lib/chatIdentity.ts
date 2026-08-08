/**
 * Partner-facing chat identity.
 *
 * Partners talk to "Administration", never to a named internal account, so the
 * real profile name of an admin is never rendered on a partner surface. One
 * helper, used by every chat component, keeps that consistent.
 */

export const ADMIN_DISPLAY_ROLES = ["admin"] as const;

/**
 * The name to show for a chat participant.
 * `viewerRole` is the signed-in user's role; only staff see real admin names.
 */
export function chatDisplayName(
  name: string | null | undefined,
  role: string | null | undefined,
  viewerRole: string | null | undefined,
  adminLabel: string,
): string {
  const viewerIsStaff = viewerRole === "admin" || viewerRole === "team_member";
  if (!viewerIsStaff && role === "admin") return adminLabel;
  return name?.trim() || adminLabel;
}
