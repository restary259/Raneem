import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, CheckCircle2, Circle, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useCaseFinancials } from "@/hooks/useCaseFinancials";
import { submitCaseForReview, sendInvoiceEmail } from "@/services/CaseInvoiceService";

interface Props {
  caseId: string;
  actorId: string;
  actorName: string;
  onSuccess: () => void;
}

/**
 * Team finance gate.
 *
 * The checkbox is UX confirmation only. `submit_case_for_review` performs the
 * authoritative server-side validation before changing the case status or
 * issuing the DARB-only invoice.
 */
export default function PaymentConfirmationForm({ caseId, onSuccess }: Props) {
  const { toast } = useToast();
  const { t } = useTranslation("dashboard");
  const { financials, isLoading, error, refetch } = useCaseFinancials(caseId);
  const [confirmed, setConfirmed] = useState(false);
  const [profileComplete, setProfileComplete] = useState(false);
  const [schoolReady, setSchoolReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    let active = true;
    const loadSubmission = async () => {
      const { data, error: submissionError } = await (supabase as any)
        .from("case_submissions")
        .select("profile_completed_at, school_id, program_id, program_start_date")
        .eq("case_id", caseId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!active || submissionError) return;
      setProfileComplete(!!data?.profile_completed_at);
      setSchoolReady(!!data?.school_id && !!data?.program_id && !!data?.program_start_date);
    };

    void loadSubmission();
    return () => {
      active = false;
    };
  }, [caseId]);

  const total = Number(financials?.service_total ?? 0);
  const agencyPaid = useMemo(
    () =>
      (financials?.payments ?? []).some(
        (payment) => payment.payment_type === "agency_service" && payment.status === "confirmed",
      ),
    [financials?.payments],
  );

  const ready = profileComplete && schoolReady && total > 0 && agencyPaid;

  const handleConfirm = async () => {
    if (!confirmed) {
      toast({
        variant: "destructive",
        description: "Please confirm that the DARB agency service fee has been received.",
      });
      return;
    }
    if (total <= 0) {
      toast({ variant: "destructive", description: "Select DARB services before confirming payment." });
      return;
    }

    setSaving(true);
    try {
      const { error: rpcError } = await (supabase as any).rpc("confirm_agency_service_payment", {
        p_case_id: caseId,
      });
      if (rpcError) throw rpcError;

      await refetch();
      toast({ title: t("team.payment.confirmed", "DARB payment confirmed") });
    } catch (err: any) {
      console.error("[PaymentConfirmation]", err);
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: err?.message || t("common.actionFailed"),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!ready || !confirmed) return;
    setSubmitting(true);
    try {
      const invoice = await submitCaseForReview(caseId);
      const emailed = await sendInvoiceEmail(invoice);
      toast({
        title: t("case.submit.success", "Case submitted to Admin"),
        description: emailed
          ? t("case.invoice.emailSent", { number: invoice.invoice_number })
          : t("case.invoice.emailFailed", { number: invoice.invoice_number }),
        variant: emailed ? undefined : "destructive",
      });
      onSuccess();
    } catch (err: any) {
      toast({
        variant: "destructive",
        description: err?.message || t("common.actionFailed"),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const row = (ok: boolean, text: string) => (
    <div className="flex items-center gap-2 text-sm">
      {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>{text}</span>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/30 p-4">
        <p className="text-sm font-medium">DARB agency services · ILS</p>
        <p className="mt-1 text-2xl font-bold">{isLoading ? "…" : `₪${total.toLocaleString("en-US")}`}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Calculated automatically from selected DARB services. Team members cannot enter or change this amount.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!agencyPaid && (
        <>
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <Checkbox id="darb_payment_received" checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} />
            <label htmlFor="darb_payment_received" className="cursor-pointer text-sm leading-tight">
              I confirm that the DARB agency service fee has been received from the student.
            </label>
          </div>
          <Button onClick={handleConfirm} disabled={saving || isLoading || total <= 0 || !confirmed} className="w-full">
            {saving ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
            {saving ? "Confirming…" : "Confirm DARB Payment"}
          </Button>
        </>
      )}

      {agencyPaid && (
        <div className="space-y-3 rounded-lg border p-4">
          <div>
            <p className="text-sm font-semibold">Ready to send to Admin</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Germany school payments are verified separately by Admin after the student provides payment proof.
            </p>
          </div>
          <div className="space-y-2">
            {row(profileComplete, "Student profile complete")}
            {row(schoolReady, "School and course data complete")}
            {row(total > 0, "DARB services selected")}
            {row(true, "DARB service payment confirmed by Team")}
            {row(true, "Germany payments verified separately by Admin")}
          </div>
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <Checkbox id="submit_agency_confirmation" checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} />
            <label htmlFor="submit_agency_confirmation" className="cursor-pointer text-sm leading-tight">
              I confirm that the DARB agency service fee has been received from the student.
            </label>
          </div>
          <Button className="w-full gap-1.5" disabled={!ready || !confirmed || submitting} onClick={handleSubmit}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {submitting ? "Submitting…" : "Submit case to Admin"}
          </Button>
        </div>
      )}
    </div>
  );
}
