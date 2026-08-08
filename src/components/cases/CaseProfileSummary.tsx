import { useTranslation } from "react-i18next";
import { readStudentProfile, PROFILE_FIELD_LABEL_KEYS } from "@/lib/studentProfileFields";

interface Props {
  caseData: Record<string, unknown>;
  submission: Record<string, unknown> | null;
}

export default function CaseProfileSummary({ caseData, submission }: Props) {
  const { t } = useTranslation("dashboard");
  const values = readStudentProfile(caseData, submission);
  const rows = (Object.keys(PROFILE_FIELD_LABEL_KEYS) as Array<keyof typeof values>).map((key) => ({
    key,
    label: t(PROFILE_FIELD_LABEL_KEYS[key]),
    value: values[key],
  }));

  return (
    <section className="rounded-md border bg-card p-4 sm:p-5">
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(({ key, label, value }) => (
          <div key={key} className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 break-words text-sm font-medium text-foreground">
              {value || t("case.terminal.notProvided")}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}