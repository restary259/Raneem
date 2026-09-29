import { useTranslation } from "react-i18next";
import { SectionCard } from "@/components/shell";
import { Badge } from "@/components/ui/badge";
import { FolderOpen, ExternalLink } from "lucide-react";
import VisaDocumentSelector from "./VisaDocumentSelector";
import type { VisaApplicationRow, VisaDocument } from "@/services/VisaService";

/**
 * The Visa document workspace. Files are NOT copied here — this renders the
 * student's existing `documents` rows (from the private `student-documents`
 * bucket) and lets the admin select the ones used for the application.
 *
 * Legacy `visa_applications.*_url` columns are surfaced as fallback links only
 * when present, so older visa records keep working; they are never the new
 * mechanism.
 */
export default function VisaDocumentsPanel({
  documents,
  selectedIds,
  application,
  busyId,
  onToggleSelect,
  onPreview,
  onDownload,
}: {
  documents: VisaDocument[];
  selectedIds: Set<string>;
  application: VisaApplicationRow | null;
  busyId: string | null;
  onToggleSelect: (doc: VisaDocument, selected: boolean) => void;
  onPreview: (doc: VisaDocument) => void;
  onDownload: (doc: VisaDocument) => void;
}) {
  const { t } = useTranslation("dashboard");

  const legacyLinks = application
    ? [
        {
          key: "health_insurance_url",
          label: t("visa.healthInsurance", "Health insurance"),
          url: application.health_insurance_url,
        },
        {
          key: "accommodation_proof_url",
          label: t("visa.accommodationProof", "Accommodation proof"),
          url: application.accommodation_proof_url,
        },
        {
          key: "bank_statement_url",
          label: t("visa.bankStatement", "Bank statement"),
          url: application.bank_statement_url,
        },
      ].filter((l) => !!l.url)
    : [];

  return (
    <SectionCard
      title={t("admin.visa.documents", "Documents")}
      icon={FolderOpen}
      actions={
        <Badge variant="outline" className="border-border text-xs tabular-nums">
          {selectedIds.size} {t("admin.visa.selectedShort", "selected")}
        </Badge>
      }
    >
      <div className="space-y-4">
        <VisaDocumentSelector
          documents={documents}
          selectedIds={selectedIds}
          busyId={busyId}
          onToggleSelect={onToggleSelect}
          onPreview={onPreview}
          onDownload={onDownload}
        />

        {legacyLinks.length > 0 && (
          <div className="border-t border-border/50 pt-3">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("admin.visa.legacyLinks", "Legacy document links")}
            </p>
            <div className="flex flex-wrap gap-2">
              {legacyLinks.map((l) => (
                <a
                  key={l.key}
                  href={l.url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-primary hover:bg-muted"
                >
                  <ExternalLink className="h-3 w-3" />
                  {l.label}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
