import React from "react";
import { useTranslation } from "react-i18next";
import { CardContent } from "@/components/ui/card";
import type { Tables } from "@/integrations/supabase/types";

interface CaseStudentTabProps {
  caseData: Tables<"cases">;
  submission: Tables<"case_submissions"> | null;
}

interface Fact {
  label: string;
  value: string | null;
}

const text = (value: unknown): string | null =>
  value === null || value === undefined || value === "" ? null : String(value);

function FactList({ title, facts }: { title: string; facts: Fact[] }) {
  const shown = facts.filter((fact) => fact.value !== null);
  if (shown.length === 0) return null;

  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <dl className="space-y-3">
        {shown.map((fact) => (
          <div key={fact.label}>
            <dt className="text-xs text-muted-foreground">{fact.label}</dt>
            <dd className="text-sm font-medium">{fact.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Read-only summary of who the student is. Editing lives in `CaseProfileForm`. */
export default function CaseStudentTab({ caseData, submission }: CaseStudentTabProps) {
  const { t } = useTranslation("dashboard");
  const extraData = (submission?.extra_data ?? {}) as Record<string, unknown>;
  const gender = text(extraData.gender);

  const personal: Fact[] = [
    { label: t("case.profileForm.fullName"), value: text(caseData.full_name) },
    { label: t("case.overview.phone"), value: text(caseData.phone_number) },
    { label: t("case.extra.student_email"), value: text(extraData.student_email) },
    { label: t("case.fields.dateOfBirth"), value: text(extraData.date_of_birth) },
  ];

  const academic: Fact[] = [
    { label: t("case.overview.bagrut"), value: text(caseData.bagrut_score) },
    { label: t("case.overview.englishUnits"), value: text(caseData.english_units) },
    { label: t("case.overview.mathUnits"), value: text(caseData.math_units) },
    {
      label: t("case.fields.gender"),
      value: gender ? t(`case.genderValues.${gender}`, { defaultValue: gender }) : null,
    },
  ];

  const emergencyName = text(extraData.emergency_contact_name);
  const emergencyPhone = text(extraData.emergency_contact_phone);

  return (
    <CardContent className="space-y-6 pt-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <FactList title={t("case.profileForm.headings.personal")} facts={personal} />
        <FactList title={t("case.studentTab.academicBackground")} facts={academic} />
      </div>

      {(emergencyName || emergencyPhone) && (
        <div className="border-t pt-4">
          <FactList
            title={t("case.fields.emergencyContact")}
            facts={[
              { label: t("case.profileForm.emergencyName"), value: emergencyName },
              { label: t("case.profileForm.emergencyPhone"), value: emergencyPhone },
            ]}
          />
        </div>
      )}
    </CardContent>
  );
}
