import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Circle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCaseFinancials } from "@/hooks/useCaseFinancials";

interface Props {
  caseId: string;
  profileComplete: boolean;
  schoolReady: boolean;
  canSubmit: boolean;
  submitting: boolean;
  onSubmit: () => void;
}

/**
 * Team-side submission gate. The checklist is UX only; submit_case_for_review
 * performs the authoritative server-side validation.
 */
export default function CaseSubmissionChecklist({
  caseId,
  profileComplete,
  schoolReady,
  canSubmit,
  submitting,
  onSubmit,
}: Props) {
  const { t } = useTranslation("dashboard");
  const { financials, isLoading } = useCaseFinancials(caseId);
  const [confirm, setConfirm] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const serviceTotal = Number(financials?.service_total ?? 0);
  const agencyPaid = useMemo(
    () =>
      (financials?.payments ?? []).some(
        (payment) => payment.payment_type === "agency_service" && payment.status === "confirmed",
      ),
    [financials?.payments],
  );

  const ready = profileComplete && schoolReady && serviceTotal > 0 && agencyPaid;

  const row = (ok: boolean, text: string) => (
    <div className="flex items-center gap-2 text-sm">
      {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>{text}</span>
    </div>
  );

  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold">{t("case.submit.readyTitle", "Ready to send to Admin")}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {t(
            "case.submit.readyDescription",
            "Germany school payments are verified separately by Admin after the student provides payment proof.",
          )}
        </p>
      </div>

      <div className="space-y-2">
        {row(profileComplete, t("case.submit.profileComplete", "Student profile complete"))}
        {row(schoolReady, t("case.submit.schoolReady", "School and course data complete"))}
        {row(serviceTotal > 0, t("case.submit.servicesSelected", "DARB services selected"))}
        {row(agencyPaid, t("case.submit.agencyPaid", "DARB service payment confirmed by Team"))}
        {row(true, t("case.submit.germanySeparate", "Germany payments verified separately by Admin"))}
      </div>

      <div className="flex items-start gap-3 rounded-lg border p-3">
        <Checkbox id={`submit-confirm-${caseId}`} checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} />
        <label htmlFor={`submit-confirm-${caseId}`} className="cursor-pointer text-sm leading-tight">
          {t("case.submit.agencyConfirmation", "I confirm that the DARB agency service fee has been received from the student.")}
        </label>
      </div>

      <Button
        className="w-full gap-1.5"
        disabled={!canSubmit || !ready || !accepted || submitting || isLoading}
        onClick={() => setConfirm(true)}
      >
        <Send className="h-4 w-4" />
        {t("case.submit.action", "Submit case to Admin")}
      </Button>

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("case.submit.confirmTitle", "Submit case to Admin")}</DialogTitle>
            <DialogDescription>
              {t(
                "case.submit.confirmBody",
                "The DARB agency-service invoice will be issued from the authoritative service total. Germany school payments remain separate and require Admin verification after proof is submitted.",
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirm(false)} disabled={submitting}>
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              disabled={submitting}
              onClick={() => {
                setConfirm(false);
                onSubmit();
              }}
            >
              {t("case.submit.confirmAction", "Submit to Admin")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
