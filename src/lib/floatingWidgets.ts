/** Dashboard role prefixes — every one owns its own layout and nav. */
export const DASHBOARD_PREFIXES = ['/admin', '/team', '/partner', '/agent', '/student'] as const;

/**
 * Legacy dashboard routes that immediately redirect into a role dashboard.
 * They must hide the public widgets during the redirect, otherwise the tabs
 * flash over the incoming dashboard.
 */
export const DASHBOARD_ALIASES = ['/team-dashboard', '/student-dashboard'] as const;

export function isDashboardPath(pathname: string): boolean {
  if ((DASHBOARD_ALIASES as readonly string[]).includes(pathname)) return true;
  return DASHBOARD_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * The floating public side tabs (WhatsApp + app install) and the public bottom
 * nav belong to the public site only. On a dashboard they would overlap the
 * dashboard's own MobileBottomNav, and the app-download tab must never compete
 * with the signed-in app experience.
 */
/** Sign-in style pages keep a clean, distraction-free screen. */
export const AUTH_PATHS = ['/student-auth', '/reset-password', '/activate'] as const;

export function shouldShowFloatingWidgets(pathname: string): boolean {
  if ((AUTH_PATHS as readonly string[]).includes(pathname)) return false;
  return pathname !== '/apply' && !isDashboardPath(pathname);
}
