import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CasePayment {
  id: string;
  case_id: string;
  invoice_id: string | null;
  payment_type: string;
  amount: number;
  paid_status: string;
  paid_date: string | null;
  note: string | null;
  created_at: string;
}

export function useCasePayments(caseId: string | undefined) {
  const [payments, setPayments] = useState<CasePayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!caseId) return;
    setIsLoading(true);
    const { data } = await (supabase as any)
      .from("case_payments")
      .select("*")
      .eq("case_id", caseId)
      .order("paid_date", { ascending: false });
    setPayments((data ?? []) as CasePayment[]);
    setIsLoading(false);
  }, [caseId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const totalPaid = payments
    .filter((p) => p.paid_status === "paid")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  return { payments, totalPaid, isLoading, refetch };
}
