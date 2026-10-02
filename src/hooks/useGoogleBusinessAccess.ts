import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { hasGoogleBusinessAccess } from "@/lib/googleBusinessApi";
import { subscribeTables } from "@/lib/realtimeRegistry";

/**
 * Whether the signed-in team member is assigned to at least one Google
 * Business office (PRIMARY or SIDE_MANAGER). The Google Business nav entry and
 * its tabs stay hidden until this returns true.
 *
 * The decision is the server's (`has_google_business_access`), never inferred
 * from client state. It returns `null` while unresolved so the route gate can
 * wait instead of bouncing a legitimate operator, and `false` on any failure
 * (a failed read hides the surface rather than leaking it). It re-reads on
 * `office_google_operators` realtime changes so an assignment or removal takes
 * effect immediately.
 */
export function useGoogleBusinessAccess(active = true): boolean | null {
  const { user, initialized } = useAuth();
  const userId = user?.id;
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    if (!active || !initialized || !userId) {
      setHasAccess(false);
      return;
    }
    const { data, error } = await hasGoogleBusinessAccess();
    if (error) {
      console.error("[google-access] lookup failed:", error);
      setHasAccess(false);
      return;
    }
    setHasAccess(data === true);
  }, [active, initialized, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!active || !initialized || !userId) return;
    return subscribeTables(
      "google-business-access",
      ["office_google_operators"],
      () => void load(),
    );
  }, [active, initialized, userId, load]);

  return hasAccess;
}
