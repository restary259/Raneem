import { supabase } from "@/integrations/supabase/client";

/** Shape returned by `confirm_agency_service_payment` since migration
    20260810150000 (which also flips the legacy payment_confirmed flag and
    advances the case status). */
export interface AgencyPaymentConfirmation {
  caseId: string;
  financeType: "service_fee";
  status: "confirmed";
  /** Authoritative DARB service total (ILS) computed server-side. */
  serviceTotal: number;
  /** Case status after confirmation (usually `payment_confirmed`). */
  caseStatus: string;
  alreadyConfirmed: boolean;
}

/**
 * Authoritative DARB payment confirmation.
 *
 * The amount is intentionally not accepted from the caller. Supabase calculates
 * it from case_services, marks the finance confirmation, flips the legacy
 * payment_confirmed flag, and advances the case status — all atomically.
 */
export async function confirmAgencyServicePayment(caseId: string): Promise<AgencyPaymentConfirmation> {
  if (!caseId) throw new Error("Case id is required.");

  const { data, error } = await (supabase as any).rpc("confirm_agency_service_payment", {
    p_case_id: caseId,
  });
  if (error) throw error;

  return {
    caseId: String(data?.case_id ?? caseId),
    financeType: data?.finance_type ?? "service_fee",
    status: data?.status ?? "confirmed",
    serviceTotal: Number(data?.service_total ?? 0),
    caseStatus: String(data?.case_status ?? ""),
    alreadyConfirmed: Boolean(data?.already_confirmed ?? false),
  };
}

/** @deprecated Use confirmAgencyServicePayment. Manual DARB amounts are no longer supported. */
export async function recordServiceFeePayment(params: { caseId: string }): Promise<string | null> {
  const result = await confirmAgencyServicePayment(params.caseId);
  return result.caseId || null;
}
