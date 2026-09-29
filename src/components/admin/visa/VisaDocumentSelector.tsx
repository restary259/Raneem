import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Eye, File, FileText, Loader2, User, X } from "lucide-react";
import type { VisaDocument } from "@/services/VisaService";

const formatBytes = (bytes?: number | null, mbLabel = "MB") => {
  if (!bytes) return "";
  return `${(bytes / (1024 * 1024)).toFixed(2)} ${mbLabel}`;
};

/**
 * One row per EXISTING student document. Selecting only records a link in
 * `visa_application_documents` — the file is never copied or re-uploaded, and
 * removing a selection never deletes the underlying document.
 */
export default function VisaDocumentSelector({
  documents,
  selectedIds,
  busyId,
  onToggleSelect,
  onPreview,
  onDownload,
}: {
  documents: VisaDocument[];
  selectedIds: Set<string>;
  busyId: string | null;
  onToggleSelect: (doc: VisaDocument, selected: boolean) => void;
  onPreview: (doc: VisaDocument) => void;
  onDownload: (doc: VisaDocument) => void;
}) {
  const { t, i18n } = useTranslation("dashboard");
  const isAr = i18n.language === "ar";

  if (documents.length === 0) {
    return (
      <p className="py-2 text-xs text-muted-foreground">
        {t("admin.visa.noDocuments", "No documents uploaded yet.")}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {documents.map((doc) => {
        const selected = selectedIds.has(doc.id);
        const busy = busyId === doc.id;
        return (
          <div
            key={doc.id}
            className={`flex items-center justify-between gap-2 rounded-lg border p-3 ${
              selected
                ? "border-[hsl(var(--status-enrolled)/0.4)] bg-[hsl(var(--status-enrolled)/0.06)]"
                : "border-border/50 bg-muted"
            }`}
          >
            <div className="flex min-w-0 items-center gap-2">
              <File className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 space-y-0.5">
                <p className="truncate text-sm font-medium text-foreground">
                  {doc.file_name}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className="px-1 py-0 text-xs capitalize"
                  >
                    {t(
                      `documents.categories.${doc.category}`,
                      doc.category.replace(/_/g, " "),
                    )}
                  </Badge>
                  {doc.file_size ? (
                    <span className="text-xs text-muted-foreground">
                      {formatBytes(doc.file_size, t("documents.mb"))}
                    </span>
                  ) : null}
                  {selected && (
                    <Badge
                      variant="outline"
                      className="border-0 bg-[hsl(var(--status-enrolled)/0.14)] text-[hsl(var(--status-enrolled))]"
                    >
                      <Check className="me-1 h-3 w-3" />
                      {t("admin.visa.selectedForVisa", "Selected for Visa")}
                    </Badge>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    {new Date(doc.created_at).toLocaleDateString(
                      isAr ? "ar-SA" : "en-US",
                    )}
                  </span>
                  {doc.uploader_name && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {doc.uploader_name}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onPreview(doc)}
                aria-label={t("admin.visa.preview", "Preview")}
                title={t("admin.visa.preview", "Preview")}
              >
                <Eye className="h-3.5 w-3.5 text-primary" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onDownload(doc)}
                aria-label={t("admin.visa.download", "Download")}
                title={t("admin.visa.download", "Download")}
              >
                <FileText className="h-3.5 w-3.5 text-primary" />
              </Button>
              <Button
                variant={selected ? "ghost" : "outline"}
                size="sm"
                className="h-7 gap-1 text-xs"
                disabled={busy}
                onClick={() => onToggleSelect(doc, !selected)}
              >
                {busy ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : selected ? (
                  <X />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                {selected
                  ? t("admin.visa.removeSelection", "Remove")
                  : t("admin.visa.selectForVisa", "Select")}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
