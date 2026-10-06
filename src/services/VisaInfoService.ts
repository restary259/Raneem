import { supabase } from "@/integrations/supabase/client";
import type { VisaInfoData, VisaInfoStatus } from "@/lib/visaInfoSchema";

const db = supabase as any;

export interface VisaInfoRecord {
  info: VisaInfoData;
  status: VisaInfoStatus;
  lastStep: number;
  updatedAt: string | null;
  submittedAt: string | null;
  checkedAt: string | null;
  correctionNote: string | null;
}

const EMPTY: VisaInfoRecord = {
  info: {}, status: "draft", lastStep: 0, updatedAt: null, submittedAt: null, checkedAt: null, correctionNote: null,
};

export async function getVisaInfo(caseId: string): Promise<VisaInfoRecord> {
  const { data, error } = await db
    .from("visa_applications")
    .select("info, info_status, info_last_step, info_updated_at, info_submitted_at, info_checked_at, info_correction_note")
    .eq("case_id", caseId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return EMPTY;
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

export async function saveVisaInfoSection(caseId: string, section: string, payload: Record<string, unknown>, lastStep: number) {
  const { error } = await db.rpc("save_my_visa_info", {
    p_case_id: caseId, p_section: section, p_payload: payload, p_last_step: lastStep,
  });
  if (error) throw error;
}

export async function submitVisaInfo(caseId: string) {
  const { error } = await db.rpc("submit_my_visa_info", { p_case_id: caseId });
  if (error) throw error;
}

export async function reviewVisaInfo(caseId: string, decision: "checked" | "needs_correction", note: string) {
  const { error } = await db.rpc("review_visa_info", { p_case_id: caseId, p_decision: decision, p_note: note });
  if (error) throw error;
}
