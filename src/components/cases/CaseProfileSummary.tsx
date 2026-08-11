import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { readStudentProfile, PROFILE_FIELD_LABEL_KEYS } from "@/lib/studentProfileFields";

interface Props {
  caseData: Record<string, unknown>;
  submission: Record<string, unknown> | null;
}

/**
 * Fields whose stored value is a foreign-key UUID. These are resolved to
 * their display names (school / program / insurance / accommodation) so the
 * summary never leaks raw ids.
 */
const ID_FIELDS = ["school_id", "program_id", "insurance_id", "accommodation_id"] as const;

type IdField = (typeof ID_FIELDS)[number];

interface NameLookup {
  school_id: Record<string, string>;
  program_id: Record<string, string>;
  insurance_id: Record<string, string>;
  accommodation_id: Record<string, string>;
}

const EMPTY_NAMES: NameLookup = { school_id: {}, program_id: {}, insurance_id: {}, accommodation_id: {} };

export default function CaseProfileSummary({ caseData, submission }: Props) {
  const { t, i18n } = useTranslation("dashboard");
  const values = readStudentProfile(caseData, submission);

  const [names, setNames] = useState<NameLookup>(EMPTY_NAMES);

  useEffect(() => {
    let cancelled = false;

    const preferred = (r: { name_en?: string | null; name_ar?: string | null } | null | undefined) =>
      r
        ? i18n.language === "ar"
          ? r.name_ar || r.name_en
          : r.name_en || r.name_ar
        : "";

    const ids = {
      school_id: values.school_id,
      program_id: values.program_id,
      insurance_id: values.insurance_id,
      accommodation_id: values.accommodation_id,
    };

    (async () => {
      const [schoolRes, programRes, insuranceRes, accommodationRes] = await Promise.all([
        ids.school_id
          ? supabase.from("schools").select("id, name_en, name_ar").eq("id", ids.school_id).maybeSingle()
          : Promise.resolve({ data: null } as any),
        ids.program_id
          ? supabase.from("programs").select("id, name_en, name_ar").eq("id", ids.program_id).maybeSingle()
          : Promise.resolve({ data: null } as any),
        ids.insurance_id
          ? (supabase as any).from("insurances").select("id, name").eq("id", ids.insurance_id).maybeSingle()
          : Promise.resolve({ data: null } as any),
        ids.accommodation_id
          ? supabase.from("accommodations").select("id, name_en, name_ar").eq("id", ids.accommodation_id).maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);
      if (cancelled) return;

      setNames({
        school_id: schoolRes.data ? { [schoolRes.data.id]: preferred(schoolRes.data) || schoolRes.data.id } : {},
        program_id: programRes.data ? { [programRes.data.id]: preferred(programRes.data) || programRes.data.id } : {},
        insurance_id: insuranceRes.data ? { [insuranceRes.data.id]: insuranceRes.data.name || insuranceRes.data.id } : {},
        accommodation_id: accommodationRes.data
          ? { [accommodationRes.data.id]: preferred(accommodationRes.data) || accommodationRes.data.id }
          : {},
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [values.school_id, values.program_id, values.insurance_id, values.accommodation_id, i18n.language]);

  const rows = (Object.keys(PROFILE_FIELD_LABEL_KEYS) as Array<keyof typeof values>).map((key) => ({
    key,
    label: t(PROFILE_FIELD_LABEL_KEYS[key]),
    value: ID_FIELDS.includes(key as IdField) ? names[key as IdField][values[key]] || values[key] : values[key],
  }));

  return (
    <section className="rounded-md border bg-card p-4 sm:p-5">
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(({ key, label, value }) => (
          <div key={key} className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 break-words text-sm font-medium text-foreground">
              {value || t("case.terminal.notProvided")}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
