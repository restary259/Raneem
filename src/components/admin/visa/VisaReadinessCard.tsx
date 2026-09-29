import { useTranslation } from "react-i18next";
import { SectionCard } from "@/components/shell";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardCheck,
  BookOpen,
  FileStack,
  AlertTriangle,
} from "lucide-react";
import {
  computeVisaReadiness,
  type ReadinessDocumentLike,
  type ReadinessFieldLike,
} from "@/lib/visaStatus";

/**
 * Readiness helper — NOT a legal-advice engine. It only counts data that
 * already exists (configured visa fields, their answers, and the student's
 * uploaded documents). Nothing is invented; a proof field is satisfied by its
 * flag being set OR by a document of the matching category being selected.
 */
export default function VisaReadinessCard({
  fields,
  values,
  documents,
  selectedDocumentIds,
}: {
  fields: ReadinessFieldLike[];
  values: Record<string, string>;
  documents: ReadinessDocumentLike[];
  selectedDocumentIds: Set<string>;
}) {
  const { t } = useTranslation("dashboard");
  const readiness = computeVisaReadiness(
    fields,
    values,
    documents,
    selectedDocumentIds,
  );
  const infoPct =
    readiness.fieldsTotal === 0
      ? 0
      : Math.round((readiness.fieldsFilled / readiness.fieldsTotal) * 100);

  return (
    <SectionCard
      title={t("admin.visa.readiness", "Visa file readiness")}
      icon={ClipboardCheck}
      className="border-border/70"
    >
      <div className="space-y-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <BookOpen className="h-3.5 w-3.5" />
              {t("admin.visa.information", "Information")}
            </span>
            <span className="font-medium tabular-nums text-foreground">
              {readiness.fieldsFilled} / {readiness.fieldsTotal}
            </span>
          </div>
          <Progress value={infoPct} className="h-1.5" />
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <FileStack className="h-3.5 w-3.5" />
              {t("admin.visa.documentsSelectedLabel", "Documents selected")}
            </span>
            <p className="mt-1 text-base font-semibold tabular-nums text-foreground">
              {readiness.documentsSelected}
            </p>
          </div>
          <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <AlertTriangle className="h-3.5 w-3.5" />
              {t("admin.visa.missingInformation", "Missing information")}
            </span>
            <p className="mt-1 text-base font-semibold tabular-nums text-foreground">
              {readiness.missingFields}
            </p>
          </div>
        </div>

        {readiness.expectedDocuments.length > 0 && (
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("admin.visa.expectedDocuments", "Expected documents")} ·{" "}
              {readiness.expectedDocuments.length - readiness.missingDocuments}/
              {readiness.expectedDocuments.length}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {readiness.expectedDocuments.map((item) => (
                <Badge
                  key={item.key}
                  variant="outline"
                  className={
                    item.fulfilled
                      ? "border-0 bg-[hsl(var(--status-enrolled)/0.14)] text-[hsl(var(--status-enrolled))]"
                      : "border-border text-muted-foreground"
                  }
                >
                  {t(
                    `admin.visa.docKey.${item.key}`,
                    item.key.replace(/_/g, " "),
                  )}
                </Badge>
              ))}
            </div>
            {readiness.missingDocuments > 0 && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                {t(
                  "admin.visa.missingDocuments",
                  "{{count}} expected item(s) not yet covered",
                  {
                    count: readiness.missingDocuments,
                  },
                )}
              </p>
            )}
          </div>
        )}
      </div>
    </SectionCard>
  );
}
