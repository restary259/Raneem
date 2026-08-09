import { supabase } from "@/integrations/supabase/client";

/**
 * Authoritative DARB payment confirmation.
 *
 * The amount is intentionally not accepted from the caller. Supabase calculates
 * it from case_services and creates/updates the agency_service payment row.
 */
export async function confirmAgencyServicePayment(caseId: string): Promise<{ paymentId: string; amountIls: number }> {
  if (!caseId) throw new Error("Case id is required.");

  const { data, error } = await (supabase as any).rpc("confirm_agency_service_payment", {
    p_case_id: caseId,
  });
  if (error) throw error;

  return {
    paymentId: String(data?.payment_id ?? ""),
    amountIls: Number(data?.amount_ils ?? 0),
  };
}

/** @deprecated Use confirmAgencyServicePayment. Manual DARB amounts are no longer supported. */
export async function recordServiceFeePayment(params: { caseId: string }): Promise<string | null> {
  const result = await confirmAgencyServicePayment(params.caseId);
  return result.paymentId || null;
}
