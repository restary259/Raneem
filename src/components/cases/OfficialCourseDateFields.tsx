import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarDays, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { calculateCourseEndDate, formatCourseDate, retainOfficialStartDate } from "@/utils/courseSchedule";

interface StartDateRow {
  start_date: string;
  audience: string | null;
  course_code: string | null;
  note_en: string | null;
  note_ar: string | null;
}

interface Props {
  schoolId: string;
  value: string;
  weeks: string | number;
  onChange: (date: string) => void;
  error?: string;
}

export default function OfficialCourseDateFields({ schoolId, value, weeks, onChange, error }: Props) {
  const { t, i18n } = useTranslation("dashboard");
  const [dates, setDates] = useState<StartDateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const endDate = useMemo(() => calculateCourseEndDate(value, weeks), [value, weeks]);

  useEffect(() => {
    let cancelled = false;
    setDates([]);
    setLoadError(false);
    if (!schoolId) return;

    setLoading(true);
    (async () => {
      const partner = await (supabase as any)
        .from("partner_schools")
        .select("id")
        .eq("catalog_school_id", schoolId)
        .eq("is_active", true)
        .maybeSingle();
      if (partner.error) throw partner.error;
      if (!partner.data?.id) return [];

      const result = await (supabase as any)
        .from("school_start_dates")
        .select("start_date,audience,course_code,note_en,note_ar")
        .eq("school_id", partner.data.id)
        .order("start_date");
      if (result.error) throw result.error;
      const today = new Date().toISOString().slice(0, 10);
      return ((result.data ?? []) as StartDateRow[]).filter((row) => row.start_date >= today || row.start_date === value);
    })()
      .then((rows) => {
        if (cancelled) return;
        setDates(rows);
        const retained = retainOfficialStartDate(value, rows.map((row) => row.start_date));
        if (retained !== value) onChange(retained);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // Reload only when the school changes. `onChange` is intentionally not a
    // dependency because callers pass an inline setter wrapper.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  const noteFor = (row: StartDateRow) =>
    i18n.language.startsWith("ar") ? row.note_ar || row.note_en : row.note_en || row.note_ar;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div data-field="program_start_date">
        <Label className={error ? "text-destructive" : ""}>{t("case.courseSchedule.officialStart")}</Label>
        <Select value={value} onValueChange={onChange} disabled={!schoolId || loading || dates.length === 0}>
          <SelectTrigger className={error ? "mt-1 border-destructive" : "mt-1"}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SelectValue placeholder={t("case.courseSchedule.selectDate")} />}
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {dates.map((row) => (
              <SelectItem key={row.start_date} value={row.start_date}>
                <span className="flex min-w-0 flex-col text-start">
                  <span>{formatCourseDate(row.start_date)}</span>
                  {noteFor(row) && <span className="max-w-72 truncate text-xs text-muted-foreground">{noteFor(row)}</span>}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {error ? (
          <p className="mt-1 text-xs text-destructive">{error}</p>
        ) : loadError ? (
          <p className="mt-1 text-xs text-destructive">{t("case.courseSchedule.loadFailed")}</p>
        ) : schoolId && !loading && dates.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">{t("case.courseSchedule.noDates")}</p>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">{t("case.courseSchedule.officialOnly")}</p>
        )}
      </div>

      <div>
        <Label>{t("case.courseSchedule.finalClass")}</Label>
        <div className="mt-1 flex min-h-10 items-center gap-2 rounded-md border bg-muted/30 px-3 text-sm">
          <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span>{endDate ? formatCourseDate(endDate) : t("case.courseSchedule.chooseDateAndWeeks")}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{t("case.courseSchedule.endRule")}</p>
      </div>
    </div>
  );
}