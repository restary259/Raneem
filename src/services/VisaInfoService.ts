import { supabase } from "@/integrations/supabase/client";
import type { VisaInfoData, VisaInfoStatus } from "@/lib/visaInfoSchema";

const db = supabase as any;

/**
 * Visa Information is keyed by STUDENT (public.student_visa_info), so a
 * student can fill it before a study file exists. Writes go only through the
 * security-definer RPCs; reads are RLS-scoped (student own / admin / team
 * creator-or-assigned).
 */
export interface VisaInfoRecord {
  info: VisaInfoData;
  status: VisaInfoStatus;
  lastStep: number;
  updatedAt: string | null;
  submittedAt: string | null;
  checkedAt: string | null;
  correctionNote: string | null;
}

export const EMPTY_VISA_INFO: VisaInfoRecord = {
  info: {}, status: "draft", lastStep: 0, updatedAt: null, submittedAt: null, checkedAt: null, correctionNote: null,
};

export async function getVisaInfo(studentId: string): Promise<VisaInfoRecord> {
  const { data, error } = await db
    .from("student_visa_info")
    .select("info, info_status, info_last_step, info_updated_at, info_submitted_at, info_checked_at, info_correction_note")
    .eq("student_user_id", studentId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return EMPTY_VISA_INFO;
  return {
    info: (data.info ?? {}) as VisaInfoData,
    status: (data.info_status ?? "draft") as VisaInfoStatus,
    lastStep: data.info_last_step ?? 0,
    updatedAt: data.info_updated_at ?? null,
    submittedAt: data.info_submitted_at ?? null,
    checkedAt: data.info_checked_at ?? null,
    correctionNote: data.info_correction_note ?? null,
  };
}

/** Saves one section for the signed-in student (identity comes from the session). */
export async function saveVisaInfoSection(section: string, payload: Record<string, unknown>, lastStep: number) {
  const { error } = await db.rpc("save_my_student_visa_info", {
    p_section: section, p_payload: payload, p_last_step: lastStep,
  });
  if (error) throw error;
}

export async function submitVisaInfo() {
  const { error } = await db.rpc("submit_my_student_visa_info");
  if (error) throw error;
}

export async function reviewVisaInfo(studentId: string, decision: "checked" | "needs_correction", note: string) {
  const { error } = await db.rpc("review_student_visa_info", {
    p_student_id: studentId, p_decision: decision, p_note: note,
  });
  if (error) throw error;
}
