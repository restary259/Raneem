import { supabase } from "@/integrations/supabase/client";

/**
 * Record a collected agency service fee against a case.
 *
 * All money goes through the `submit_case_payment` RPC: the server checks the
 * caller owns the case, refuses amounts above the case total, and de-duplicates
 * on `idem_key` so a double submit cannot create two payment rows. The payment
 * lands as `submitted` — only an admin can confirm it, so a team member can
 * never make money look officially received.
 */
export async function recordServiceFeePayment(params: {
  caseId: string;
  actorId: string;
  amount: number;
  paidAt?: string;
  note?: string;
  /** Stable key so a retry/double-click returns the existing payment. */
  idemKey?: string;
}): Promise<string | null> {
  const { caseId, amount } = params;
  if (!(amount > 0)) return null;

  const { data, error } = await (supabase as any).rpc("submit_case_payment", {
    p_case_id: caseId,
    p_amount: amount,
    p_note: params.note ?? null,
    p_idem_key: params.idemKey ?? `service_fee:${caseId}:${amount}`,
    p_payment_type: "service_fee",
  });
  if (error) throw error;
  return (data as string) ?? null;
}
