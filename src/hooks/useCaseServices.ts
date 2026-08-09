import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CaseService {
  id: string;
  case_id: string;
  service_id: string | null;
  description: string | null;
  category: string | null;
  unit_price: number;
  quantity: number;
  discount: number;
  notes: string | null;
  added_by: string | null;
  created_at: string;
  updated_at: string;
  currency: string;
  pricing_model: string | null;
  unit_label: string | null;
  catalog_version: number | null;
  commissionable: boolean | null;
  snapshot_at: string | null;
}

export function useCaseServices(caseId: string | undefined) {
  const [services, setServices] = useState<CaseService[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!caseId) {
      setServices([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from("case_services")
        .select(
          `
          id,
          case_id,
          service_id,
          description,
          category,
          unit_price,
          quantity,
          discount,
          notes,
          added_by,
          created_at,
          updated_at,
          currency,
          pricing_model,
          unit_label,
          catalog_version,
          commissionable,
          snapshot_at
        `,
        )
        .eq("case_id", caseId)
        .order("created_at", { ascending: true });

      if (queryError) {
        throw queryError;
      }

      const normalized: CaseService[] = (data ?? []).map((service: any) => ({
        id: service.id,
        case_id: service.case_id,
        service_id: service.service_id ?? null,
        description: service.description ?? null,
        category: service.category ?? null,
        unit_price: Number(service.unit_price ?? 0),
        quantity: Number(service.quantity ?? 1),
        discount: Number(service.discount ?? 0),
        notes: service.notes ?? null,
        added_by: service.added_by ?? null,
        created_at: service.created_at,
        updated_at: service.updated_at,
        currency: service.currency ?? "ILS",
        pricing_model: service.pricing_model ?? null,
        unit_label: service.unit_label ?? null,
        catalog_version:
          service.catalog_version !== null && service.catalog_version !== undefined
            ? Number(service.catalog_version)
            : null,
        commissionable:
          service.commissionable !== null && service.commissionable !== undefined
            ? Boolean(service.commissionable)
            : null,
        snapshot_at: service.snapshot_at ?? null,
      }));

      setServices(normalized);
    } catch (err: any) {
      console.error("Failed to load case services:", err);
      setServices([]);
      setError(err?.message ?? "Unable to load case services.");
    } finally {
      setIsLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return {
    services,
    isLoading,
    error,
    refetch,
  };
}
