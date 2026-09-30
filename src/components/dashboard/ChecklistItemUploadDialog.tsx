import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { uploadStudentDocument } from "@/lib/studentDocuments";
import { MAX_UPLOAD_BYTES } from "@/lib/uploadRules";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, FileText, Loader2, Upload } from "lucide-react";

export interface ChecklistUploadTarget {
  id: string;
  name: string;
  /** The item the student already completed; the popup switches to an uncheck flow. */
  completed: boolean;
  /** Existing document for this item, if one was uploaded before. */
  existingDocument?: { id: string; file_name: string } | null;
}

interface ChecklistItemUploadDialogProps {
  studentId: string;
  target: ChecklistUploadTarget | null;
  onClose: () => void;
  /** Re-fetch after a successful upload/confirm so the tracker reflects the change. */
  onChanged: () => void | Promise<void>;
  /** Clears completion for an already-completed item (the uncheck path). */
  onUncheck: (itemId: string) => void | Promise<void>;
}

const MAX_MB = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024));

/**
 * The popup a student gets when they tap a checklist item.
 *
 * Two modes, decided by the item's current state:
 * - not completed → collect the requested document, then confirm. The confirm
 *   button is disabled until a file is chosen, so an item cannot be marked done
 *   without the document the checklist asked for.
 * - already completed → offer to uncheck (and, if a file is attached, say so).
 *
 * The upload goes through the shared `uploadStudentDocument`, so the file lands
 * in the same private bucket with the same `documents` row shape the Documents
 * page reads — that is what makes it appear there automatically.
 */
const ChecklistItemUploadDialog: React.FC<ChecklistItemUploadDialogProps> = ({
  studentId,
  target,
  onClose,
  onChanged,
  onUncheck,
}) => {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Synchronous companion to `isSaving`: two taps in the same tick both read the
  // state as false, which would fire two uploads for one confirmation.
  const savingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const itemId = target?.id ?? null;
  const completed = target?.completed ?? false;

  useEffect(() => {
    setFile(null);
    setNotes("");
    setExpiryDate("");
    setFormError(null);
    setIsSaving(false);
    savingRef.current = false;
  }, [itemId]);

  const handleConfirm = async () => {
    if (!target) return;
    if (savingRef.current) return;

    if (!file) {
      setFormError(t("checklist.uploadFileRequired", "Please choose the requested document first."));
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    setFormError(null);

    try {
      await uploadStudentDocument({
        studentId,
        file,
        // The checklist is a fixed document taxonomy; these items are the
        // student's core paperwork, so they land under "other" with the
        // checklist item's own name as the display name.
        category: "other",
        fileName: target.name,
        notes: notes || null,
        expiryDate: expiryDate || null,
        checklistItemId: target.id,
      });

      const { error: completionError } = await supabase
        .from("student_checklist")
        .upsert(
          {
            student_id: studentId,
            checklist_item_id: target.id,
            is_completed: true,
            completed_at: new Date().toISOString(),
          },
          { onConflict: "student_id,checklist_item_id" },
        );
      if (completionError) throw completionError;

      toast({
        title: t("checklist.uploadSuccess", "Document uploaded"),
        description: t("checklist.uploadSuccessDesc", "It is now saved on your Documents page."),
      });
      onClose();
      await onChanged();
    } catch (err: any) {
      setFormError(err.message ?? t("common.error", "Error"));
      toast({
        variant: "destructive",
        title: t("documents.uploadError", "Upload failed"),
        description: err.message,
      });
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const handleUncheck = async () => {
    if (!target || savingRef.current) return;
    savingRef.current = true;
    setIsSaving(true);
    try {
      await onUncheck(target.id);
      onClose();
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && !isSaving && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {completed ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-[hsl(var(--status-enrolled))]" />
            ) : (
              <Upload className="h-5 w-5 shrink-0 text-primary" />
            )}
            <span className="min-w-0 break-words">{target?.name}</span>
          </DialogTitle>
          <DialogDescription>
            {completed
              ? t(
                  "checklist.uploadDoneDesc",
                  "You already marked this as complete. You can uncheck it if it was a mistake.",
                )
              : t(
                  "checklist.uploadDesc",
                  "Upload the requested document, then confirm to mark this step as done.",
                )}
          </DialogDescription>
        </DialogHeader>

        {completed ? (
          <div className="space-y-3">
            {target?.existingDocument ? (
              <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                <FileText className="h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{target.existingDocument.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("checklist.uploadOnDocuments", "Saved on your Documents page")}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("checklist.uploadNoFile", "No document is attached to this item.")}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="checklist-doc">{t("documents.file", "File")}</Label>
              <Input
                id="checklist-doc"
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.heic"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null);
                  setFormError(null);
                }}
              />
              <p className="text-xs text-muted-foreground">
                {t("documents.fileHint", "PDF, Word or image")} —{" "}
                {t("documents.maxSize", { defaultValue: "Max {{mb}} MB", mb: MAX_MB })}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="checklist-expiry">{t("documents.expiryDate", "Expiry date")}</Label>
              <Input
                id="checklist-expiry"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="checklist-notes">{t("documents.notes", "Notes")}</Label>
              <Textarea
                id="checklist-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t("documents.optionalNotes", "Optional notes")}
                rows={2}
              />
            </div>

            {formError && (
              <p className="text-sm text-[hsl(var(--status-danger))]" role="alert">
                {formError}
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            {t("checklist.cancelBtn", "Cancel")}
          </Button>
          {completed ? (
            <Button variant="destructive" onClick={handleUncheck} disabled={isSaving}>
              {isSaving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t("checklist.uncheckConfirmBtn", "Uncheck item")}
            </Button>
          ) : (
            <Button onClick={handleConfirm} disabled={isSaving || !file}>
              {isSaving ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="me-2 h-4 w-4" />
              )}
              {isSaving
                ? t("documents.uploading", "Uploading…")
                : t("checklist.uploadConfirmBtn", "Confirm & mark as done")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ChecklistItemUploadDialog;
