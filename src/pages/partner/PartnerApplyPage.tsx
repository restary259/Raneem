import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import ApplyForm from "@/components/apply/ApplyForm";
import DashboardLoading from "@/components/dashboard/DashboardLoading";

/**
 * In-dashboard apply form for the lawyer/partner role. The same `ApplyForm`
 * as the public page, but `embedded` (renders inside the partner dashboard
 * shell) and `useSessionAuth` (sends the partner's session token so the
 * edge function attributes the new case to them server-side). Ambassadors do
 * NOT get this route — their sidebar omits the "Apply" entry.
 */
const PartnerApplyPage: React.FC = () => {
  const { t } = useTranslation("dashboard");
  const { role, initialized } = useAuth();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  // Guard: only social_media_partner may use the in-dashboard apply form.
  // An ambassador who lands here (e.g. by URL) is redirected to their overview.
  useEffect(() => {
    if (!initialized) return;
    if (role !== "social_media_partner") {
      navigate("/partner", { replace: true });
      return;
    }
    setReady(true);
  }, [initialized, role, navigate]);

  if (!ready) return <DashboardLoading label={t("common.loading", "Loading…")} />;

  return (
    <div className="w-full">
      <ApplyForm embedded useSessionAuth onSubmitted={() => { /* stay on the success screen */ }} />
    </div>
  );
};

export default PartnerApplyPage;
