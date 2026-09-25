import { CASE_STATUS_LABELS, CASE_STATUS_ORDER, CaseStatus, STATUS_COLORS } from "@/lib/caseStatus";

/** WhatsApp lead stages are the case pipeline stages — one vocabulary everywhere. */
export const WHATSAPP_LEAD_STAGES: CaseStatus[] = [...CASE_STATUS_ORDER, CaseStatus.FORGOTTEN, CaseStatus.CANCELLED];

export function whatsappStageLabel(stage: string | null | undefined, lang: string): string {
  const key = (stage ?? "new") as CaseStatus;
  const labels = CASE_STATUS_LABELS[key];
  if (!labels) return stage ?? "";
  return lang === "ar" ? labels.ar : labels.en;
}

export function whatsappStageClass(stage: string | null | undefined): string {
  return STATUS_COLORS[stage ?? "new"] ?? STATUS_COLORS.new ?? "";
}
