import React from "react";
import { useTranslation } from "react-i18next";
import { CardContent } from "@/components/ui/card";
import { AlertTriangle, Check } from "lucide-react";
import { differenceInCalendarDays, format, isValid } from "date-fns";
import { ar, enUS } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";
import type { AppointmentRow } from "@/components/cases/CaseStageBlock";

interface CaseOverviewTabProps {
  caseData: Tables<"cases">;
  submission: Tables<"case_submissions"> | null;
  documents?: { category: string }[];
  appointments?: AppointmentRow[];
  pendingAppt?: AppointmentRow | null;
}

const parseDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return isValid(date) ? date : null;
};

export default function CaseOverviewTab({
  caseData,
  submission,
  documents = [],
  appointments = [],
  pendingAppt = null,
}: CaseOverviewTabProps) {
  const { t, i18n } = useTranslation("dashboard");
  const locale = i18n.language?.startsWith("ar") ? ar : enUS;

  const hasPassport = documents.some((doc) => doc.category === "passport");
  const pendingCount = appointments.filter((appt) => !appt.outcome).length;
  const createdAt = parseDate(caseData.created_at);
  const ageInDays = createdAt ? differenceInCalendarDays(new Date(), createdAt) : null;
  const nextApptAt = parseDate(pendingAppt?.scheduled_at);

  const stats: { label: string; value: string; hint: React.ReactNode }[] = [
    {
      label: t("case.detail.documents"),
      value: String(documents.length),
      hint: (
        <span className="inline-flex items-center gap-1">
          {hasPassport ? (
            <Check className="h-3 w-3 text-primary" aria-hidden />
          ) : (
            <AlertTriangle className="h-3 w-3 text-destructive" aria-hidden />
          )}
          {hasPassport ? t("case.overviewTab.passportUploaded") : t("case.overviewTab.passportMissing")}
        </span>
      ),
    },
    {
      label: t("case.detail.appointments"),
      value: String(appointments.length),
      hint:
        appointments.length === 0
          ? t("case.detail.noAppointments")
          : pendingCount > 0
            ? t("case.overviewTab.pendingCount", { count: pendingCount })
            : t("case.overviewTab.allCompleted"),
    },
    {
      label: t("case.detail.payment"),
      value: submission?.payment_confirmed ? "✓" : "…",
      hint: submission?.payment_confirmed
        ? t("case.overview.paymentConfirmed")
        : t("case.overview.paymentPending"),
    },
    {
      label: t("case.overview.createdAt"),
      value: ageInDays === null ? t("case.overview.notSet") : String(ageInDays),
      hint: ageInDays === null ? "" : t("case.overviewTab.daysAgo", { count: ageInDays }),
    },
  ];

  const facts: { label: string; value: string | null }[] = [
    { label: t("case.fields.city"), value: caseData.city },
    {
      label: t("case.overview.educationLevel"),
      value: caseData.education_level
        ? t(`case.educationLevels.${caseData.education_level}`, { defaultValue: caseData.education_level })
        : null,
    },
    { label: t("case.overviewTab.englishLevel"), value: caseData.english_level },
    { label: t("case.overview.degreeInterest"), value: caseData.degree_interest },
  ];

  return (
    <CardContent className="space-y-6 pt-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="space-y-1 rounded-lg bg-muted/50 p-3">
            <p className="text-xs font-semibold text-muted-foreground">{stat.label}</p>
            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.hint}</p>
          </div>
        ))}
      </div>

      {nextApptAt && (
        <div className="border-s-4 border-primary ps-4 py-2">
          <p className="text-sm font-semibold text-foreground">{t("case.overview.nextAppointment")}</p>
          <p className="text-sm text-muted-foreground">{format(nextApptAt, "PPp", { locale })}</p>
          {pendingAppt?.notes && (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("case.overviewTab.notes", { notes: pendingAppt.notes })}
            </p>
          )}
        </div>
      )}

      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {facts
          .filter((fact) => fact.value)
          .map((fact) => (
            <div key={fact.label}>
              <dt className="text-xs font-semibold text-muted-foreground">{fact.label}</dt>
              <dd className="text-sm font-medium text-foreground">{fact.value}</dd>
            </div>
          ))}
      </dl>
    </CardContent>
  );
}
