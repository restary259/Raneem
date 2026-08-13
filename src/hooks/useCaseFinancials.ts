import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * The single authoritative read for case money.
 *
 * Every total shown in the UI comes from `get_case_financials` on the server —
 * the frontend never re-adds prices, so a displayed total can never disagree
 * with the database. Prices on the service lines are the snapshots taken when
 * the service was selected, so changing the admin catalog later cannot rewrite
 * an existing case.
 */

export interface FinancialServiceLine {
  id: string;
  service_id: string | null;
  description: string;
  category: string;
  quantity: number;
  unit_price: number;
  discount: number;
  currency: string;
  line_total: number;
}

export interface FinancialSchoolLine {
  kind: "program" | "accommodation" | "insurance";
  name_ar: string | null;
  name_en: string | null;
  weekly_price: number | null;
  weeks: number | null;
  total: number;
  currency: string;
  estimate: boolean;
}

export type PaymentStatus = "pending" | "submitted" | "confirmed" | "rejected";

export interface FinancialPayment {
  id: string;
  amount: number;
  currency: string;
  payment_type: string;
  status: PaymentStatus;
  note: string | null;
  submitted_by: string | null;
  submitted_at: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  rejected_reason: string | null;
  created_at: string;
}

export interface CaseFinancials {
  case_id: string;
  case_reference: string | null;
  student_name: string | null;
  status: string | null;
  /** Selected school (from case_submissions) — part of the submission gate. */
  school_id: string | null;
  currency: string;
  services: FinancialServiceLine[];
  service_total: number;
  /** Referral discount applied to this case (₪), already netted out of service_total. */
  referral_discount: number;
  school_costs: FinancialSchoolLine[];
  payments: FinancialPayment[];
  total_confirmed: number;
  total_pending_review: number;
  remaining: number;
}

export function useCaseFinancials(caseId: string | undefined) {
  const [data, setData] = useState<CaseFinancials | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!caseId) return;
    setIsLoading(true);
    const { data: res, error: err } = await (supabase as any).rpc("get_case_financials", {
      p_case_id: caseId,
    });
    if (err) {
      setError(err.message);
      setData(null);
    } else {
      setError(null);
      setData(res as CaseFinancials);
    }
    setIsLoading(false);
  }, [caseId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { financials: data, isLoading, error, refetch };
}
