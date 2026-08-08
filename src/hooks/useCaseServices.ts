import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CatalogService {
  id: string;
  name_ar: string;
  name_en: string;
  category: string;
  default_price: number;
  is_active: boolean;
  sort_order: number;
}

export interface CaseService {
  id: string;
  case_id: string;
  service_id: string | null;
  description: string;
  category: string;
  unit_price: number;
  quantity: number;
  discount: number;
  notes: string | null;
  created_at: string;
}

export function caseServiceTotal(s: Pick<CaseService, "unit_price" | "quantity" | "discount">) {
  return Number(s.unit_price || 0) * Number(s.quantity || 0) - Number(s.discount || 0);
}

export function useServiceCatalog() {
  const [catalog, setCatalog] = useState<CatalogService[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    const { data } = await (supabase as any)
      .from("service_catalog")
      .select("*")
      .order("sort_order", { ascending: true });
    setCatalog((data ?? []) as CatalogService[]);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { catalog, isLoading, refetch };
}

export function useCaseServices(caseId: string | undefined) {
  const [services, setServices] = useState<CaseService[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!caseId) return;
    setIsLoading(true);
    const { data } = await (supabase as any)
      .from("case_services")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: true });
    setServices((data ?? []) as CaseService[]);
    setIsLoading(false);
  }, [caseId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const total = services.reduce((sum, s) => sum + caseServiceTotal(s), 0);

  return { services, total, isLoading, refetch };
}
