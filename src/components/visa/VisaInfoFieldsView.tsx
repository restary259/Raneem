import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { VISA_INFO_STEPS, isFieldVisible, type VisaInfoData, type VisaInfoStatus, type VisaInfoField } from "@/lib/visaInfoSchema";
import { toneClasses } from "@/lib/statusTokens";

export const VISA_INFO_STATUS_TONE: Record<VisaInfoStatus, Parameters<typeof toneClasses>[0]> = {
  draft: "neutral",
  in_progress: "contacted",
  submitted: "contacted",
  needs_correction: "danger",
  checked: "enrolled",
};

export function VisaInfoStatusBadge({ status }: { status: VisaInfoStatus }) {
  const { t } = useTranslation("dashboard");
  return (
    <Badge variant="outline" className={toneClasses(VISA_INFO_STATUS_TONE[status]).chip}>
      {t(`visaInfo.status.${status}`)}
    </Badge>
  );
}

export function useVisaValueLabel() {
  const { t } = useTranslation("dashboard");
  return (f: VisaInfoField, v: string | undefined) => {
    if (v === undefined || v === "") return "—";
    if (f.type === "yesno" || f.type === "select") return t(`visaInfo.o.${v}`, v);
    return v;
  };
}

/** Grouped read-only summary used by the student review step and staff panels. */
export default function VisaInfoFieldsView({
  data, showGerman, onEdit,
}: { data: VisaInfoData; showGerman?: boolean; onEdit?: (stepIndex: number) => void }) {
  const { t } = useTranslation("dashboard");
  const label = useVisaValueLabel();
  return (
    <div className="space-y-4">
      {VISA_INFO_STEPS.map((step, i) => {
        const sec = data[step.id] ?? {};
        const visible = step.fields.filter((f) => isFieldVisible(f, sec));
        return (
          <section key={step.id} className="rounded-lg border border-border p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">{t(`visaInfo.steps.${step.id}`)}</h3>
              {onEdit && (
                <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(i)}>
                  <Pencil className="h-3.5 w-3.5 me-1" /> {t("visaInfo.edit")}
                </Button>
              )}
            </div>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
              {visible.map((f) => (
                <div key={f.key} className="min-w-0">
                  <dt className="text-xs text-muted-foreground">
                    {t(`visaInfo.f.${f.key}`)}
                    {showGerman && f.de && <span className="ms-1 opacity-70" dir="ltr">({f.de})</span>}
                  </dt>
                  <dd className="text-sm break-words" dir="auto">{label(f, sec[f.key])}</dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}
    </div>
  );
}
