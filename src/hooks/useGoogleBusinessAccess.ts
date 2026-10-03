import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { hasGoogleBusinessAccess } from "@/lib/googleBusinessApi";
import { subscribeTables } from "@/lib/realtimeRegistry";

/**
 * Whether the signed-in team member is assigned to at least one office (as an
 * active `office_members` row that also holds a Google Business operator role,
 * PRIMARY or SIDE_MANAGER). This is the app's "has an office" fact: the Offices
 * nav entry, the Google Business nav entry and the office workspace Team tab
 * all stay hidden until it returns true.
 *
 * The decision is the server's (`has_google_business_access`), never inferred
 * from client state. It returns `null` while unresolved so the route gate can
 * wait instead of bouncing a legitimate operator, and `false` on any failure
 * (a failed read hides the surface rather than leaking it).
 *
 * Access is revoked by more than an operator-row change: a team member can be
 * deactivated (`profiles`) or dropped from the office (`office_members`) while
 * the Google page is open. The hook therefore re-reads on all three realtime
 * tables and again whenever the tab regains focus, so a long-open page cannot
 * keep showing data the server would now refuse.
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
      ["office_google_operators", "office_members", "profiles"],
      () => void load(),
    );
  }, [active, initialized, userId, load]);

  useEffect(() => {
    if (!active || !initialized || !userId) return;
    const revalidate = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", revalidate);
    document.addEventListener("visibilitychange", revalidate);
    return () => {
      window.removeEventListener("focus", revalidate);
      document.removeEventListener("visibilitychange", revalidate);
    };
  }, [active, initialized, userId, load]);

  return hasAccess;
}
