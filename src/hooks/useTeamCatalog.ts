/**
 * Read-only catalog data for the Team Catalog presentation page.
 *
 * Source of truth: the `schools` / `accommodations` tables managed by the
 * Admin Catalog (AdminProgramsPage). Team users have SELECT-only RLS on both
 * tables (see migrations 20260305005304 + 20260810070000), so this hook can
 * never mutate catalog data — it is a pure consumer.
 *
 * A single Promise.all fetch on mount (no per-keystroke refetch); the catalog
 * is small and search/filter are applied client-side. Matches the existing
 * TeamWorkPage fetch-returns-cleanup pattern.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CatalogSchool, CatalogAccommodation, CatalogProgram } from "@/lib/catalogDisplay";

export interface TeamCatalogData {
  schools: CatalogSchool[];
  accommodations: CatalogAccommodation[];
  programs: CatalogProgram[];
}

interface UseTeamCatalogState {
  data: TeamCatalogData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useTeamCatalog(): UseTeamCatalogState {
  const [data, setData] = useState<TeamCatalogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const [schoolsRes, accommodationsRes, programsRes] = await Promise.all([
          supabase
            .from("schools")
            .select("*")
            .eq("is_active", true)
            .order("name_en", { ascending: true }),
          supabase
            .from("accommodations")
            .select("*")
            .eq("is_active", true)
            .order("name_en", { ascending: true }),
          supabase
            .from("programs")
            .select("*")
            .eq("is_active", true)
            .order("name_en", { ascending: true }),
        ]);
        if (cancelled) return;
        if (schoolsRes.error) throw schoolsRes.error;
        if (accommodationsRes.error) throw accommodationsRes.error;
        if (programsRes.error) throw programsRes.error;
        setData({
          schools: (schoolsRes.data ?? []) as CatalogSchool[],
          accommodations: (accommodationsRes.data ?? []) as CatalogAccommodation[],
          programs: (programsRes.data ?? []) as CatalogProgram[],
        });
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load catalog");
        setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [nonce]);

  return { data, loading, error, refetch };
}
