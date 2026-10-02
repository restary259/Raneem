import React from "react";
import { Navigate } from "@/lib/router-compat";
import { useGoogleBusinessAccess } from "@/hooks/useGoogleBusinessAccess";
import { DashboardRouteFallback } from "@/components/shell/RouteFallbacks";

/**
 * Route-level guard for the team Google Business pages. Hiding the nav entry is
 * cosmetic only; a member who types `/team/google` directly must still be sent
 * back to their dashboard unless the server confirms an operator assignment.
 * The data RPCs are office-scoped and reject an unassigned caller regardless,
 * so this gate closes the URL, not the security boundary.
 */
export default function GoogleBusinessAccessGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const hasAccess = useGoogleBusinessAccess();

  // Wait for the server answer so a legitimate operator is not bounced on a
  // cold load. Once resolved, anything but an explicit `true` sends the member
  // back to their dashboard.
  if (hasAccess === null) return <DashboardRouteFallback />;
  if (!hasAccess) return <Navigate to="/team" replace />;

  return <>{children}</>;
}
