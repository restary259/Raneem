import React from "react";
import { useTranslation } from "react-i18next";
import { CalendarPlus, PhoneCall, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/utils/dateUtils";

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


/** Renders only the working surface for the stage the case is actually in.
    The profile-completion and payment-confirmed stages live in the tabbed
    layout (CaseProfilePanel + CaseFinance) instead of here. */
export default function CaseStageBlock(props: Props) {
  const { t } = useTranslation("dashboard");
  const { caseData, appointments, canManage } = props;
  const status = caseData.status as string;

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
                  <p className="text-sm font-medium">{formatDateTime(appt.scheduled_at, "")}</p>
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

  if (status === "cancelled") {
    return (
      <Shell title={t("case.restore.title", "Case Cancelled")}>
        <p className="text-sm text-muted-foreground">
          {t("case.restore.desc", "This case was cancelled. You can restore it to the Contacted stage to re-engage the student.")}
        </p>
        {canManage && (
          <Button
            variant="outline"
            className="gap-1.5 border-emerald-500/50 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
            onClick={() => props.onAdvance("contacted")}
          >
            <RotateCcw className="h-4 w-4" />
            {t("case.restore.action", "Restore Case")}
          </Button>
        )}
      </Shell>
    );
  }

  return null;
}
