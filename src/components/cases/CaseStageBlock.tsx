import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarPlus, PhoneCall, Send, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import CaseProfileForm from "./CaseProfileForm";
import CaseInviteStudent from "./CaseInviteStudent";
import {
  missingProfileFields,
  PROFILE_FIELD_LABEL_KEYS,
  readStudentProfile,
  type StudentProfileValues,
} from "@/lib/studentProfileFields";

export interface AppointmentRow {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  outcome: string | null;
  notes: string | null;
}

interface Props {
  caseData: Record<string, any>;
  submission: Record<string, any> | null;
  appointments: AppointmentRow[];
  canManage: boolean;
  onSchedule: () => void;
  onRecordOutcome: (appointmentId: string) => void;
  onAdvance: (to: string) => void;
  onConfirmPayment: () => void;
  onRefresh: () => void;
  onSubmitToAdmin: () => void;
  /** Resend a case that admin sent back for changes. */
  onResubmit: () => void;

  submitting: boolean;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

/** Renders only the working surface for the stage the case is actually in. */
export default function CaseStageBlock(props: Props) {
  const { t } = useTranslation("dashboard");
  const { caseData, submission, appointments, canManage } = props;
  const status = caseData.status as string;
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  const Shell = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );

  if (status === "new" || status === "forgotten") {
    return (
      <Shell title={t("case.detail.markContacted")}>
        <p className="text-sm text-muted-foreground">{t("case.detail.markContactedDesc")}</p>
        {canManage && (
          <Button className="gap-1.5" onClick={() => props.onAdvance("contacted")}>
            <PhoneCall className="h-4 w-4" />
            {t("case.detail.markContacted")}
          </Button>
        )}
      </Shell>
    );
  }

  if (status === "contacted") {
    return (
      <Shell title={t("case.detail.scheduleAppt")}>
        <p className="text-sm text-muted-foreground">{t("case.detail.scheduleApptDesc")}</p>
        {canManage && (
          <Button className="gap-1.5" onClick={props.onSchedule}>
            <CalendarPlus className="h-4 w-4" />
            {t("case.header.schedule")}
          </Button>
        )}
      </Shell>
    );
  }

  if (status === "appointment_scheduled") {
    const allRecorded = appointments.length > 0 && appointments.every((a) => a.outcome);
    return (
      <Shell title={t("case.detail.appointments")}>
        {appointments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("case.detail.noAppointments")}</p>
        ) : (
          <div className="divide-y">
            {appointments.map((appt) => (
              <div key={appt.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{fmtDate(appt.scheduled_at)}</p>
                  <p className="text-xs text-muted-foreground">
                    {appt.outcome
                      ? t(`team.outcome.${appt.outcome}`, appt.outcome)
                      : t("case.detail.pendingOutcome")}
                  </p>
                </div>
                {canManage && !appt.outcome && (
                  <Button size="sm" variant="outline" onClick={() => props.onRecordOutcome(appt.id)}>
                    {t("case.tasks.action.recordOutcome")}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {canManage && (
            <Button variant="outline" className="gap-1.5" onClick={props.onSchedule}>
              <CalendarPlus className="h-4 w-4" />
              {t("case.detail.addAppointment")}
            </Button>
          )}
          {canManage && allRecorded && (
            <Button onClick={() => props.onAdvance("profile_completion")}>
              {t("case.detail.completeProfile")}
            </Button>
          )}
        </div>
      </Shell>
    );
  }

  if (status === "profile_completion") {
    const values = readStudentProfile(caseData, submission);
    const missing = missingProfileFields(values);
    const savedComplete = !!submission?.profile_completed_at && missing.length === 0;
    const reopened = submission?.review_status === "changes_requested";
    const fieldName = (f: keyof StudentProfileValues) => t(PROFILE_FIELD_LABEL_KEYS[f]);
    return (
      <Shell title={t("case.detail.completeProfile")}>
        {reopened && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
            <p className="text-sm font-medium text-amber-700">
              {t("case.submit.changesRequested")}
            </p>
            {submission?.review_note && (
              <p className="mt-1 text-sm text-muted-foreground">{submission.review_note}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {t("case.submit.fixAndResend", {
                defaultValue:
                  "Make the requested change below, save the file, then send it back to admin.",
              })}
            </p>
          </div>
        )}
        <CaseProfileForm caseData={caseData} submission={submission} onSaved={props.onRefresh} />
        {savedComplete && (
          <CaseInviteStudent
            caseId={caseData.id}
            fullName={caseData.full_name}
            phone={values.student_phone}
            email={values.student_email}
            studentUserId={(caseData.student_user_id as string) ?? null}
            onDone={props.onRefresh}
          />
        )}
        {canManage && (
          <div className="border-t pt-4">
            {!savedComplete ? (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
                <p className="text-sm font-medium text-amber-700">
                  {t("case.detail.paymentBlocked")}
                </p>
                {missing.length > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {missing.map(fieldName).join(" · ")}
                  </p>
                )}
              </div>
            ) : reopened && submission?.payment_confirmed ? (
              <Button
                className="gap-1.5"
                disabled={props.submitting}
                onClick={() => setConfirmSubmit(true)}
              >
                <Send className="h-4 w-4" />
                {t("case.submit.resend", { defaultValue: "Send back to admin" })}
              </Button>
            ) : (
              <Button className="gap-1.5" onClick={props.onConfirmPayment}>
                <Wallet className="h-4 w-4" />
                {t("case.tasks.action.confirmPayment")}
              </Button>
            )}
          </div>
        )}
        <Dialog open={confirmSubmit} onOpenChange={setConfirmSubmit}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("case.submit.confirmTitle")}</DialogTitle>
              <DialogDescription>{t("case.submit.confirmBody")}</DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmSubmit(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                disabled={props.submitting}
                onClick={() => {
                  setConfirmSubmit(false);
                  props.onResubmit();
                }}
              >
                {t("case.submit.confirmAction")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </Shell>
    );
  }


  if (status === "payment_confirmed") {
    return (
      <Shell title={t("case.detail.submittedToAdmin")}>
        <p className="text-sm text-muted-foreground">{t("case.stageBlock.paymentBody")}</p>
        {canManage && (
          <Button
            className="gap-1.5"
            disabled={props.submitting}
            onClick={() => setConfirmSubmit(true)}
          >
            <Send className="h-4 w-4" />
            {t("case.submit.action")}
          </Button>
        )}
        <Dialog open={confirmSubmit} onOpenChange={setConfirmSubmit}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {t("case.submit.confirmTitle", {
                  defaultValue: "Send this student file to Admin?",
                })}
              </DialogTitle>
              <DialogDescription>
                {t("case.submit.confirmBody", {
                  defaultValue:
                    "The case moves to admin review and the student receives an invitation to set up their account.",
                })}
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmSubmit(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                disabled={props.submitting}
                onClick={() => {
                  setConfirmSubmit(false);
                  props.onSubmitToAdmin();
                }}
              >
                {t("case.submit.confirmAction", { defaultValue: "Confirm & send" })}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </Shell>
    );
  }

  if (status === "submitted") {
    return (
      <Shell title={t("case.detail.submittedToAdmin")}>
        <p className="text-sm text-muted-foreground">{t("case.detail.waitingAdminReview")}</p>
      </Shell>
    );
  }

  if (status === "enrollment_paid") {
    return (
      <Shell title={t("case.detail.studentEnrolled")}>
        <p className="text-sm text-muted-foreground">{t("case.detail.caseComplete")}</p>
      </Shell>
    );
  }

  return null;
}
