import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthedUserId } from "@/hooks/useAuthedUserId";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import VisaInfoWizard from "@/components/visa/VisaInfoWizard";
import DashboardLoading from "@/components/dashboard/DashboardLoading";
import { toneClasses } from "@/lib/statusTokens";
import { submitStudentVisaApplication, markOwnVisaArrived } from "@/services/VisaService";

const VISA_STATUS_COLORS: Record<string, string> = {
  not_applied: toneClasses("neutral").chip,
  applied: toneClasses("contacted").chip,
  approved: toneClasses("enrolled").chip,
  rejected: toneClasses("danger").chip,
  received: toneClasses("enrolled").chip,
};

/**
 * Student Visa page.
 *
 * The Visa Information form (VisaInfoWizard) is keyed by STUDENT, so it is
 * always available — even before the DARB team has opened a study file.
 * The old admin-defined "Visa Information" fields box and the "Legal
 * Information" box were removed here because the form asks the same
 * questions; their stored data is untouched. This page never writes to
 * visa_field_values or to the profile's legal fields.
 */
export default function StudentVisaPage() {
  const [loading, setLoading] = useState(true);
  // Admin-controlled visa status (visa_fields.field_key = "visa_status"); read-only.
  const [visaStatusValue, setVisaStatusValue] = useState<string | null>(null);

  // Submission state (post-enrollment "Submit for Administration" workflow).
  const [caseId, setCaseId] = useState<string | null>(null);
  const [caseStatus, setCaseStatus] = useState<string | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [arrivedAt, setArrivedAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { t, i18n } = useTranslation("dashboard");
  const { toast } = useToast();
  const isAr = i18n.language === "ar";

  const load = useCallback(async (uid: string) => {
    try {
      const [statusFieldRes, caseRes] = await Promise.all([
        (supabase as any)
          .from("visa_fields")
          .select("id")
          .eq("is_active", true)
          .eq("field_key", "visa_status")
          .maybeSingle(),
        (supabase as any).rpc("get_my_case"),
      ]);

      if (statusFieldRes?.data?.id) {
        const { data: v } = await (supabase as any)
          .from("visa_field_values")
          .select("value")
          .eq("student_user_id", uid)
          .eq("field_id", statusFieldRes.data.id)
          .maybeSingle();
        setVisaStatusValue(v?.value ?? null);
      } else {
        setVisaStatusValue(null);
      }

      // Resolve the student's own case. The Visa submission workflow is only
      // meaningful for an ENROLLED case (Visa is post-enrollment and must never
      // surface as an active stage before that).
      const myCase = ((caseRes?.data as any[]) ?? [])[0] ?? null;
      // An archived case can never enter the Visa workflow (the RPCs reject it).
      const usableCase = myCase && !myCase.archived ? myCase : null;
      setCaseId(usableCase?.id ?? null);
      setCaseStatus(usableCase?.status ?? null);

      if (usableCase?.id) {
        const { data: appRow } = await (supabase as any)
          .from("visa_applications")
          .select("visa_applied_at, arrived_in_germany_at")
          .eq("case_id", usableCase.id)
          .maybeSingle();
        setSubmittedAt(appRow?.visa_applied_at ?? null);
        setArrivedAt(appRow?.arrived_in_germany_at ?? null);
      } else {
        setSubmittedAt(null);
        setArrivedAt(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const userId = useAuthedUserId(load);

  const isEnrolled = caseStatus === "enrollment_paid";

  // ── Confirm arrival in Germany ──
  // The submission RPC requires the post-arrival marker (idempotent RPC).
  const confirmArrival = async () => {
    if (!caseId) return;
    setSubmitting(true);
    try {
      await markOwnVisaArrived(caseId);
      toast({ description: t("visa.arrivedToast", "Arrival confirmed.") });
      if (userId) await load(userId);
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Submit the completed Visa file to Administration ──
  // The RPC is the trust boundary (ownership + enrollment + arrival + required
  // fields). It is idempotent: a repeat submit returns already_submitted.
  const submitForAdmin = async () => {
    if (!caseId) return;
    setSubmitting(true);
    try {
      const res = await submitStudentVisaApplication(caseId);
      if (res?.already_submitted) {
        toast({ description: t("visa.alreadySubmitted", "Your Visa file was already submitted.") });
      } else {
        toast({ description: t("visa.submittedToast", "Your Visa file was submitted to Administration.") });
      }
      if (userId) await load(userId);
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const visaStatusColorClass = VISA_STATUS_COLORS[visaStatusValue ?? "not_applied"] || VISA_STATUS_COLORS.not_applied;

  if (!userId || loading) return <DashboardLoading />;

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      {/* ── Status header ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Globe className="h-5 w-5 text-primary" />
            {t("visa.title", "Visa Application")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {visaStatusValue ? (
            <Badge className={`${visaStatusColorClass} border-0 text-sm px-3 py-1`}>{visaStatusValue}</Badge>
          ) : (
            <Badge variant="secondary">{isAr ? "لم يُقدَّم بعد" : "Not Applied Yet"}</Badge>
          )}
          <p className="text-sm text-muted-foreground">
            {t("visa.readOnly", "Visa status is managed by your team member.")}
          </p>
        </CardContent>
      </Card>

      {/* ── Visa Information form (always available, saved per student) ── */}
      <VisaInfoWizard userId={userId} />

      {/* ── Submit to Administration (post-enrollment only) ── */}
      {isEnrolled && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {t("visa.submitTitle", "Submit for Administration")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Arrival must be confirmed before the file can be submitted. */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/40 p-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground">
                  {t("visa.arrivalTitle", "Arrival in Germany")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {arrivedAt
                    ? `${t("visa.arrivedOn", "Confirmed on")} ${new Date(arrivedAt).toLocaleDateString("en-US")}`
                    : t("visa.arrivalHint", "Confirm once you have arrived in Germany.")}
                </p>
              </div>
              {!arrivedAt && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={confirmArrival}
                  disabled={submitting}
                >
                  {t("visa.confirmArrival", "Confirm arrival")}
                </Button>
              )}
            </div>

            {submittedAt ? (
              <p className="text-sm text-muted-foreground">
                {t("visa.submittedOn", "Submitted on")}:{" "}
                {new Date(submittedAt).toLocaleDateString("en-US")}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t(
                  "visa.submitHint",
                  "Fill in your information and upload your documents, then submit so our team can complete your visa application.",
                )}
              </p>
            )}
            <Button
              onClick={submitForAdmin}
              disabled={submitting || !!submittedAt}
              className="w-full sm:w-auto"
            >
              {submitting
                ? t("common.saving", "Saving…")
                : submittedAt
                  ? t("visa.submitted", "Submitted")
                  : t("visa.submitAction", "Submit for Administration")}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
