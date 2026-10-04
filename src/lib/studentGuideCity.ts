import { supabase } from "@/integrations/supabase/client";

export type GuideCitySource = "school" | "residential";
export type GuideCityResult = { city: string | null; source: GuideCitySource | null };

const clean = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/**
 * Resolves which city's guide a student should see. The school decides:
 * school on the student's case (team-chosen) → school picked at onboarding →
 * home city. Throws on read failure so errors stay distinct from "no city".
 */
export async function resolveStudentGuideCity(uid: string): Promise<GuideCityResult> {
  const [{ data: subs, error: subsError }, { data: profile, error: profileError }] =
    await Promise.all([
      (supabase as any)
        .from("case_submissions")
        .select("school_id, updated_at, cases!inner(student_user_id)")
        .eq("cases.student_user_id", uid)
        .not("school_id", "is", null)
        .order("updated_at", { ascending: false })
        .limit(1),
      (supabase as any)
        .from("profiles")
        .select("residential_city, language_school_id")
        .eq("id", uid)
        .maybeSingle(),
    ]);
  if (subsError) throw subsError;
  if (profileError) throw profileError;

  const schoolIds = [subs?.[0]?.school_id, profile?.language_school_id].filter(
    (id): id is string => typeof id === "string" && id.length > 0,
  );
  for (const schoolId of schoolIds) {
    const { data: school, error } = await (supabase as any)
      .from("schools")
      .select("city")
      .eq("id", schoolId)
      .maybeSingle();
    if (error) throw error;
    const city = clean(school?.city);
    if (city) return { city, source: "school" };
  }

  const home = clean(profile?.residential_city);
  return { city: home, source: home ? "residential" : null };
}
