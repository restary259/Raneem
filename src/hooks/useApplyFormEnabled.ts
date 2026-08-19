import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Whether the signed-in user's `profiles.apply_form_enabled` admin toggle is
 * on. Defaults to `true` while loading so the common (enabled) case does not
 * flicker — the Apply page itself is the real gate and redirects away when
 * the flag is false, so a brief optimistic render is cosmetic only. Pass
 * `active = false` (e.g. for non-partner roles) to skip the profiles read.
 */
export function useApplyFormEnabled(active = true): boolean {
  const { user, initialized } = useAuth();
  const userId = user?.id;
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (!active || !initialized || !userId) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("apply_form_enabled")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setEnabled(data.apply_form_enabled);
      });
    return () => {
      cancelled = true;
    };
  }, [active, initialized, userId]);

  return enabled;
}
