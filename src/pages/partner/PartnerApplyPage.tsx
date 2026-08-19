import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import ApplyForm from "@/components/apply/ApplyForm";
import DashboardLoading from "@/components/dashboard/DashboardLoading";

/**
 * In-dashboard apply form for partners and ambassadors. The same `ApplyForm`
 * as the public page, but `embedded` (renders inside the dashboard shell) and
 * `useSessionAuth` (sends the member's session token so the edge function
 * attributes the new case to them server-side). Both roles get this route;
 * an admin can disable it per member via profiles.apply_form_enabled, which
 * removes the nav entry and redirects this page back to the overview.
 */
const PartnerApplyPage: React.FC = () => {
  const { t } = useTranslation("dashboard");
  const { user, role, initialized } = useAuth();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  // Guard: partners and ambassadors may use the in-dashboard apply form,
  // unless the admin disabled it for them (apply_form_enabled = false).
  useEffect(() => {
    if (!initialized || !user) return;
    if (role !== "social_media_partner" && role !== "ambassador") {
      navigate("/partner", { replace: true });
      return;
    }
    let cancelled = false;
    supabase
      .from("profiles")
      .select("apply_form_enabled")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data && !data.apply_form_enabled) {
          navigate("/partner", { replace: true });
          return;
        }
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [initialized, role, user, navigate]);

  if (!ready) return <DashboardLoading label={t("common.loading", "Loading…")} />;

  return (
    <div className="w-full">
      <ApplyForm embedded useSessionAuth onSubmitted={() => { /* stay on the success screen */ }} />
    </div>
  );
};

export default PartnerApplyPage;
