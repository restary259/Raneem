import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import ApplyForm from "@/components/apply/ApplyForm";
import DashboardLoading from "@/components/dashboard/DashboardLoading";
import ReferralLinkCard from "@/components/dashboard/ReferralLinkCard";
import { useDirection } from "@/hooks/useDirection";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link2, Info } from "lucide-react";

/**
 * Agent's personal apply form. Reuses the shared `ApplyForm` in `embedded`
 * mode with `useSessionAuth` so the `create-case-from-apply` edge function
 * attributes the new case to the agent server-side (partner_self — the agent
 * is the direct referrer). The agent earns the agent_self_referral_rate
 * (default ₪1000) when the case reaches enrollment_paid.
 *
 * Below the form, a shareable `/apply?ref=<code>` link card lets the agent
 * share the public apply page with students. Applications submitted through
 * that link are attributed to the agent via cases.partner_id (link method),
 * which the commission function recognizes as an agent self-referral.
 */
const AgentApplyPage: React.FC = () => {
  const { t } = useTranslation("dashboard");
  const { role, initialized, user } = useAuth();
  const { dir } = useDirection();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  // Guard: agents may use the in-dashboard apply form, unless the admin
  // disabled it for them (apply_form_enabled = false) -- same as partners.
  useEffect(() => {
    if (!initialized || !user) return;
    if (role !== "agent") {
      setReady(false);
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
          navigate("/agent", { replace: true });
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
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4" dir={dir}>
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Link2 className="h-6 w-6 text-primary" />
          {t("agent.applyTitle", "Refer a student")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("agent.applySubtitle", "Submit a student application on their behalf. The case is automatically attributed to you.")}
        </p>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              {t("agent.applyAutoAttribution", "Automatic attribution")}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("agent.applyAutoAttributionHint", "Every application you submit here is automatically linked to your agent account. You earn the self-referral reward when the case is paid.")}
            </p>
          </div>
        </CardContent>
      </Card>

      <ApplyForm embedded useSessionAuth onSubmitted={() => { /* stay on the success screen */ }} />

      {user?.id && (
        <ReferralLinkCard
          userId={user.id}
          hint={t("agent.applyLinkHint", "Share this link with students. Every application submitted through it is automatically attributed to you, and you earn the self-referral reward when the case is paid.")}
        />
      )}
    </div>
  );
};

export default AgentApplyPage;
