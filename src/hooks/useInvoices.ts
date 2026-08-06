import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  category: string;
  amount: number;
  quantity: number;
  created_at: string;
}

export interface Invoice {
  id: string;
  case_id: string;
  invoice_number: string | null;
  status: "draft" | "sent" | "paid" | "void";
  currency: string;
  notes: string | null;
  issued_at: string | null;
  due_at: string | null;
  created_at: string;
  items: InvoiceItem[];
  /** Always derived from items — never stored. */
  total: number;
}

export const INVOICE_CATEGORIES = [
  "application_fee",
  "housing",
  "insurance",
  "visa",
  "semester_fee",
  "language_school",
  "service_fee",
  "other",
] as const;

export function invoiceTotal(items: Pick<InvoiceItem, "amount" | "quantity">[]): number {
  return items.reduce((sum, it) => sum + Number(it.amount || 0) * Number(it.quantity || 0), 0);
}

export function useInvoices(caseId: string | undefined) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    if (!caseId) return;
    setIsLoading(true);
    try {
      const { data, error: err } = await (supabase as any)
        .from("invoices")
        .select("*, items:invoice_items(*)")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false });
      if (err) throw err;
      const rows: Invoice[] = (data ?? []).map((row: any) => {
        const items = (row.items ?? []).sort(
          (a: InvoiceItem, b: InvoiceItem) => a.created_at.localeCompare(b.created_at),
        );
        return { ...row, items, total: invoiceTotal(items) };
      });
      setInvoices(rows);
      setError(null);
    } catch (e: any) {
      setError(e.message ?? "Failed to load invoices");
    } finally {
      setIsLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  return { invoices, isLoading, error, refetch: fetchInvoices };
}
