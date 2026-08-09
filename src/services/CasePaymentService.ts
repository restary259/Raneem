import { supabase } from "@/integrations/supabase/client";
import { ensureCaseServices } from "@/services/CaseCostingService";

/**
 * Record a collected agency service fee against a case.
 *
 * The finance panel reads `case_services` / `case_payments` only, so a fee that
 * lives on `case_submissions` alone is invisible there. Every entry point that
 * collects money must go through this helper so the two paths cannot drift:
 * the payment-confirmation form on an existing case, and the Submit New Student
 * wizard which collects the fee up front.
 *
 * Service lines are created first (idempotent) so the payment has something to
 * settle against. A failure to seed the catalogue must not lose the payment, so
 * it is logged and the payment insert still runs.
 */
export async function recordServiceFeePayment(params: {
  caseId: string;
  actorId: string;
  amount: number;
  paidAt?: string;
}): Promise<void> {
  const { caseId, actorId, amount } = params;
  if (!(amount > 0)) return;
  const paidAt = params.paidAt ?? new Date().toISOString();

  try {
    await ensureCaseServices(caseId, actorId);
  } catch (err) {
    console.error("[CasePaymentService] ensureCaseServices", err);
  }

  const { error } = await (supabase as any).from("case_payments").insert({
    case_id: caseId,
    payment_type: "service_fee",
    amount,
    paid_status: "paid",
    paid_date: paidAt,
    recorded_by: actorId,
  });
  if (error) throw error;
}
