/**
 * Read-only data access for the internal Partner Schools reference tool.
 *
 * Read access is restricted to admin + team_member by RLS; this hook never
 * writes. Admin editing screens are a separate, later phase.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export interface PartnerCountry {
  id: string;
  slug: string;
  name_en: string;
  name_ar: string;
  flag_emoji: string | null;
  description_en: string | null;
  description_ar: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface PartnerSchoolRow {
  id: string;
  country_id: string;
  catalog_school_id: string | null;
  slug: string;
  name: string;
  city: string | null;
  address: string | null;
  website_url: string | null;
  phone: string | null;
  email: string | null;
  partner_status: string;
  standard_course_note_en: string | null;
  standard_course_note_ar: string | null;
  minimum_age: number | null;
  last_verified_at: string | null;
}

export interface SchoolDetail {
  school: PartnerSchoolRow;
  country: PartnerCountry | null;
  version: any | null;
  courses: any[];
  courseTiers: any[];
  levels: any[];
  accommodations: any[];
  accommodationTiers: any[];
  startDates: any[];
  policies: any[];
  notes: any[];
  sources: any[];
}

interface State<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function usePartnerCountries(): State<{ countries: PartnerCountry[]; schools: PartnerSchoolRow[] }> {
  const [data, setData] = useState<{ countries: PartnerCountry[]; schools: PartnerSchoolRow[] } | null>(null);
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
        const [c, s] = await Promise.all([
          db.from("partner_countries").select("*").eq("is_active", true).order("sort_order"),
          db.from("partner_schools").select("*").eq("is_active", true).order("sort_order"),
        ]);
        if (cancelled) return;
        if (c.error) throw c.error;
        if (s.error) throw s.error;
        setData({ countries: c.data ?? [], schools: s.data ?? [] });
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load partner schools");
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

export function usePartnerSchoolDetail(slug: string | undefined, year?: number): State<SchoolDetail> {
  const [data, setData] = useState<SchoolDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const schoolRes = await db.from("partner_schools").select("*").eq("slug", slug).maybeSingle();
        if (schoolRes.error) throw schoolRes.error;
        const school = schoolRes.data as PartnerSchoolRow | null;
        if (!school) throw new Error("School not found");

        let versionQuery = db.from("school_price_versions").select("*").eq("school_id", school.id);
        versionQuery = year ? versionQuery.eq("year", year) : versionQuery.eq("is_current", true);
        const [countryRes, versionRes, levelsRes, startRes, polRes, notesRes, srcRes] = await Promise.all([
          db.from("partner_countries").select("*").eq("id", school.country_id).maybeSingle(),
          versionQuery.maybeSingle(),
          db.from("school_level_durations").select("*").eq("school_id", school.id).order("sort_order"),
          db.from("school_start_dates").select("*").eq("school_id", school.id).order("start_date"),
          db.from("school_policies").select("*").eq("school_id", school.id).order("sort_order"),
          db.from("school_notes").select("*").eq("school_id", school.id).eq("is_active", true).order("sort_order"),
          db.from("school_sources").select("*").eq("school_id", school.id).order("sort_order"),
        ]);
        if (cancelled) return;
        for (const r of [countryRes, versionRes, levelsRes, startRes, polRes, notesRes, srcRes]) {
          if (r.error) throw r.error;
        }
        const version = versionRes.data;

        let courses: any[] = [];
        let courseTiers: any[] = [];
        let accommodations: any[] = [];
        let accommodationTiers: any[] = [];
        if (version) {
          const [cRes, aRes] = await Promise.all([
            db.from("school_courses").select("*").eq("price_version_id", version.id).order("sort_order"),
            db.from("school_accommodations").select("*").eq("price_version_id", version.id).order("sort_order"),
          ]);
          if (cancelled) return;
          if (cRes.error) throw cRes.error;
          if (aRes.error) throw aRes.error;
          courses = cRes.data ?? [];
          accommodations = aRes.data ?? [];
          const [ctRes, atRes] = await Promise.all([
            courses.length
              ? db.from("school_course_price_tiers").select("*").in("course_id", courses.map((c) => c.id)).order("sort_order")
              : Promise.resolve({ data: [], error: null }),
            accommodations.length
              ? db
                  .from("school_accommodation_price_tiers")
                  .select("*")
                  .in("accommodation_id", accommodations.map((a) => a.id))
                  .order("sort_order")
              : Promise.resolve({ data: [], error: null }),
          ]);
          if (cancelled) return;
          if (ctRes.error) throw ctRes.error;
          if (atRes.error) throw atRes.error;
          courseTiers = ctRes.data ?? [];
          accommodationTiers = atRes.data ?? [];
        }

        setData({
          school,
          country: countryRes.data ?? null,
          version: version ?? null,
          courses,
          courseTiers,
          levels: levelsRes.data ?? [],
          accommodations,
          accommodationTiers,
          startDates: startRes.data ?? [],
          policies: polRes.data ?? [],
          notes: notesRes.data ?? [],
          sources: srcRes.data ?? [],
        });
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load school");
        setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, year, nonce]);

  return { data, loading, error, refetch };
}
