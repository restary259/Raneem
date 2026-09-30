import { supabase } from "@/integrations/supabase/client";
import { validateUploadFile } from "@/lib/uploadRules";

/**
 * The one place a student-facing document upload happens.
 *
 * Both the Documents page (`DocumentsManager`) and the checklist popup
 * (`ChecklistItemUploadDialog`) go through here, so the storage path layout,
 * the validation rules, and the `documents` row shape can never drift between
 * the two screens — a file uploaded from the checklist must render on the
 * Documents page exactly like one uploaded there.
 */

export const STUDENT_DOCUMENTS_BUCKET = "student-documents";

export interface UploadStudentDocumentInput {
  /** The owning student. Also the storage folder, which is what storage RLS checks. */
  studentId: string;
  file: File;
  category: string;
  /** Display name. Falls back to the file's own name. */
  fileName?: string;
  notes?: string | null;
  expiryDate?: string | null;
  /** Set when the upload satisfies a checklist item. */
  checklistItemId?: string | null;
}

/**
 * Validates, uploads to the private bucket, then inserts the `documents` row.
 *
 * Throws on any failure. If the row insert fails the just-uploaded object is
 * removed, so a rejected insert cannot leave an orphaned file in the bucket.
 */
export async function uploadStudentDocument(
  input: UploadStudentDocumentInput,
): Promise<{ id: string; filePath: string }> {
  const { studentId, file, category, fileName, notes, expiryDate, checklistItemId } = input;

  const uploadError = validateUploadFile(file);
  if (uploadError) throw new Error(uploadError);

  const fileExt = file.name.split(".").pop();
  const filePath = `${studentId}/${Date.now()}.${fileExt}`;

  const { error: storageError } = await supabase.storage
    .from(STUDENT_DOCUMENTS_BUCKET)
    .upload(filePath, file);
  if (storageError) throw storageError;

  const { data, error: dbError } = await supabase
    .from("documents")
    .insert({
      student_id: studentId,
      file_name: fileName?.trim() || file.name,
      file_url: filePath,
      file_size: file.size,
      file_type: file.type,
      category,
      expiry_date: expiryDate || null,
      notes: notes || null,
      checklist_item_id: checklistItemId ?? null,
      is_visible_to_student: true,
    })
    .select("id")
    .single();

  if (dbError) {
    // Don't leave the object behind if the row was rejected.
    const { error: cleanupError } = await supabase.storage
      .from(STUDENT_DOCUMENTS_BUCKET)
      .remove([filePath]);
    if (cleanupError) {
      console.warn("[uploadStudentDocument] orphan cleanup failed:", cleanupError);
    }
    throw dbError;
  }

  return { id: data.id, filePath };
}

/**
 * Removes a document that was just created (row + stored object).
 *
 * Used to roll back a partial multi-step flow: if the step *after* the upload
 * fails, the file must not be left behind, because it would render on the
 * Documents page while the action the student asked for still shows as
 * incomplete — and retrying would upload a second copy.
 *
 * Never throws: a failed rollback must not mask the original error.
 */
export async function discardStudentDocument(
  documentId: string,
  filePath: string,
): Promise<void> {
  const { error: storageError } = await supabase.storage
    .from(STUDENT_DOCUMENTS_BUCKET)
    .remove([filePath]);
  if (storageError) {
    console.warn("[discardStudentDocument] storage remove failed:", storageError);
  }
  const { error: rowError } = await supabase.from("documents").delete().eq("id", documentId);
  if (rowError) {
    console.warn("[discardStudentDocument] row delete failed:", rowError);
  }
}
