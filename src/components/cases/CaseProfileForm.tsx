import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { generateIntakeMonths } from "@/utils/intakeMonths";
import { DOB_MONTHS, DOB_YEARS, daysInMonth, normalizeDate } from "@/utils/dateUtils";
import {
  courseEndFrom,
  fullNameOf,
  missingProfileFields,
  normalizeEmail,
  PROFILE_FIELD_LABEL_KEYS,
  readStudentProfile,
  toExtraData,
  type StudentProfileValues,
} from "@/lib/studentProfileFields";
import { ensureCaseServices } from "@/services/CaseCostingService";
import { cn } from "@/lib/utils";

interface Option {
  id: string;
  name_en: string;
  name_ar: string;
  school_id?: string | null;
  duration_in_months?: number | null;
  fixed_start_day_of_month?: number | null;
}

interface Props {
  caseData: Record<string, any>;
  submission: Record<string, any> | null;
  onSaved: () => void;
}

/**
 * A stable, module-level input. Defining this inside the parent's render body
 * would create a new component type on every keystroke, remounting the input
 * and dropping focus — that was the original typing bug.
 */
const TextField = React.memo(function TextField({
  name,
  labelText,
  value,
  invalid,
  error,
  type = "text",
  placeholder,
  onChange,
}: {
  name: string;
  labelText: string;
  value: string;
  invalid?: boolean;
  error?: string;
  type?: string;
  placeholder?: string;
  onChange: (name: string, value: string) => void;
}) {
  return (
    <div data-field={name}>
      <Label className={invalid ? "text-destructive" : ""}>{labelText}</Label>
      <Input
        name={name}
        className={cn("mt-1", invalid && "border-destructive")}
        type={type}
        value={value}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(name, e.target.value)}
      />
      {invalid && error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
});

/**
 * The profile completion step. Field-for-field identical to the
 * "+ New student" form, prefilled from whatever the case already knows,
 * autosaved as a draft while it is being filled in.
 */
export default function CaseProfileForm({ caseData, submission, onSaved }: Props) {
  const { t, i18n } = useTranslation("dashboard");
  const isAr = i18n.language?.startsWith("ar");
  const { toast } = useToast();
  const { user } = useAuth();

  const [values, setValues] = useState<StudentProfileValues>(() =>
    readStudentProfile(caseData, submission),
  );
  const [schools, setSchools] = useState<Option[]>([]);
  const [programs, setPrograms] = useState<Option[]>([]);
  const [accommodations, setAccommodations] = useState<Option[]>([]);
  const [insurances, setInsurances] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(
    (submission?.draft_updated_at as string) ?? null,
  );
  const [autosaving, setAutosaving] = useState(false);
  /**
   * The three birth-date dropdowns keep their own state so each one shows the
   * user's pick immediately, in any order — the ISO value is only composed
   * once all three parts exist.
   */
  const [dob, setDobState] = useState(() => {
    const parts = (values.date_of_birth || "").split("-");
    return { year: parts[0] ?? "", month: parts[1] ?? "", day: parts[2] ?? "" };
  });
  const [dobError, setDobError] = useState<string | null>(null);

  useEffect(() => {
    const iso = values.date_of_birth || "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
    const [y, m, d] = iso.split("-");
    setDobState((prev) =>
      prev.year === y && prev.month === m && prev.day === d ? prev : { year: y, month: m, day: d },
    );
  }, [values.date_of_birth]);

  const set = useCallback(
    (key: string, value: string) => setValues((v) => ({ ...v, [key]: value })),
    [],
  );

  useEffect(() => {
    Promise.all([
      (supabase as any).from("schools").select("id,name_en,name_ar").eq("is_active", true).order("name_en"),
      (supabase as any)
        .from("programs")
        .select("id,name_en,name_ar,school_id,duration_in_months,fixed_start_day_of_month")
        .eq("is_active", true)
        .order("name_en"),
      (supabase as any)
        .from("accommodations")
        .select("id,name_en,name_ar,school_id")
        .eq("is_active", true),
      (supabase as any).from("insurances").select("id,name").eq("is_active", true),
    ]).then(([sc, p, a, ins]: any[]) => {
      setSchools(sc.data ?? []);
      setPrograms(p.data ?? []);
      setAccommodations(a.data ?? []);
      setInsurances(ins.data ?? []);
    });
  }, []);

  const label = (o: Option) => (isAr ? o.name_ar || o.name_en : o.name_en || o.name_ar);

  // A school must be chosen before anything school-specific can be selected,
  // so an accommodation from another school is simply not offered.
  const filteredPrograms = useMemo(
    () => (values.school_id ? programs.filter((p) => p.school_id === values.school_id) : []),
    [programs, values.school_id],
  );
  const filteredAccoms = useMemo(
    () => (values.school_id ? accommodations.filter((a) => a.school_id === values.school_id) : []),
    [accommodations, values.school_id],
  );
  const selectedProgram = programs.find((p) => p.id === values.program_id);
  const monthOptions = useMemo(() => generateIntakeMonths(24), []);

  // Course start follows the programme's fixed start day of the chosen intake.
  useEffect(() => {
    if (!selectedProgram?.fixed_start_day_of_month || !values.start_month) return;
    const [y, m] = values.start_month.split("-").map(Number);
    const d = selectedProgram.fixed_start_day_of_month;
    set("course_start", `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }, [selectedProgram?.fixed_start_day_of_month, values.start_month, set]);

  // Every course runs 40 weeks — the end date is derived, never typed.
  const derivedCourseEnd = courseEndFrom(values.course_start);
  useEffect(() => {
    if (derivedCourseEnd && derivedCourseEnd !== values.course_end) {
      set("course_end", derivedCourseEnd);
    }
  }, [derivedCourseEnd, values.course_end, set]);

  /** Write the current values as a draft. Never clears stored values. */
  const persist = useCallback(
    async (vals: StudentProfileValues, complete: boolean) => {
      const payload: Record<string, unknown> = {
        case_id: caseData.id,
        program_id: vals.program_id || null,
        accommodation_id: vals.accommodation_id || null,
        insurance_id: vals.insurance_id || null,
        program_start_date: vals.course_start || null,
        program_end_date: courseEndFrom(vals.course_start) || null,
        student_email: normalizeEmail(vals.student_email) || null,
        student_phone: vals.student_phone?.trim() || null,
        extra_data: toExtraData(vals, (submission?.extra_data as Record<string, unknown>) ?? {}),
        draft_updated_at: new Date().toISOString(),
      };
      if (complete) payload.profile_completed_at = new Date().toISOString();

      const { error } = await (supabase as any)
        .from("case_submissions")
        .upsert(payload, { onConflict: "case_id" });
      if (error) throw error;
      return payload.draft_updated_at as string;
    },
    [caseData.id, submission],
  );

  // Debounced autosave. Only runs once the user has actually edited something.
  const dirty = useRef(false);
  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (!dirty.current) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setAutosaving(true);
      persist(values, false)
        .then((at) => setDraftSavedAt(at))
        .catch(() => {
          /* transient — the explicit save surfaces real errors */
        })
        .finally(() => setAutosaving(false));
    }, 1200);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [values, persist]);

  const handleChange = useCallback(
    (name: string, value: string) => {
      dirty.current = true;
      set(name, value);
      setErrors((e) => e.filter((f) => f !== name));
    },
    [set],
  );

  const fieldName = (f: string) => t(PROFILE_FIELD_LABEL_KEYS[f as keyof StudentProfileValues] ?? f);

  const handleSave = async () => {
    const missing = missingProfileFields(values) as string[];
    setErrors(missing);
    if (missing.length > 0) {
      const el = document.querySelector(`[data-field="${missing[0]}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      (el?.querySelector("input, button") as HTMLElement | null)?.focus();
      toast({
        variant: "destructive",
        description:
          missing.length === 1
            ? t("case.profile.missingOne", {
                field: fieldName(missing[0]),
                defaultValue: `Please complete: ${fieldName(missing[0])}`,
              })
            : t("case.profile.missingMany", {
                field: fieldName(missing[0]),
                count: missing.length - 1,
                defaultValue: `Please complete: ${fieldName(missing[0])} (+${missing.length - 1} more)`,
              }),
      });
      return;
    }
    setSaving(true);
    try {
      const at = await persist(values, true);
      setDraftSavedAt(at);

      const name = fullNameOf(values);
      if (name && name !== caseData.full_name) {
        await supabase.from("cases").update({ full_name: name }).eq("id", caseData.id);
      }

      // The finance breakdown is generated from the admin catalog, never typed by hand.
      await ensureCaseServices(caseData.id, user?.id ?? null);

      await supabase.rpc("log_case_event", {
        p_case_id: caseData.id,
        p_event_type: "profile_updated",
        p_payload: { by: user?.id ?? null },
        p_is_internal: true,
      });

      dirty.current = false;
      toast({ description: t("case.profile.saved") });
      onSaved();
    } catch (err) {
      toast({
        variant: "destructive",
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  };

  const invalid = (field: keyof StudentProfileValues) => errors.includes(field as string);
  const errText = (field: keyof StudentProfileValues) =>
    t("case.profile.fieldRequired", { defaultValue: "This field is required" });

  const field = (
    name: keyof StudentProfileValues,
    labelText: string,
    type?: string,
    placeholder?: string,
  ) => (
    <TextField
      name={name}
      labelText={labelText}
      type={type}
      placeholder={placeholder}
      value={values[name]}
      invalid={invalid(name)}
      error={errText(name)}
      onChange={handleChange}
    />
  );

  const dobYear = dob.year;
  const dobMonth = dob.month;
  const dobDay = dob.day;
  const dobDays = Array.from(
    { length: dobMonth ? daysInMonth(parseInt(dobMonth), parseInt(dobYear) || 2000) : 31 },
    (_, i) => String(i + 1).padStart(2, "0"),
  );
  const setDob = (part: "year" | "month" | "day", v: string) => {
    setDobState((prev) => {
      const next = { ...prev, [part]: v };
      // Clamp the day when the new month/year is shorter (31 Jan → 29/28 Feb).
      if (next.month) {
        const max = daysInMonth(parseInt(next.month), parseInt(next.year) || 2000);
        if (next.day && parseInt(next.day) > max) next.day = String(max).padStart(2, "0");
      }
      if (next.year && next.month && next.day) {
        try {
          handleChange("date_of_birth", normalizeDate(next.day, next.month, next.year));
          setDobError(null);
        } catch (err: any) {
          setDobError(err?.message ?? null);
        }
      } else {
        setDobError(null);
      }
      return next;
    });
  };

  const savedLabel = draftSavedAt
    ? new Date(draftSavedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="space-y-6">
      {/* Student info */}
      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("case.profile.sections.student")}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {field("first_name", `${t("case.fields.firstName")} *`)}
          {field("middle_name", t("case.fields.middleName"))}
          {field("last_name", `${t("case.fields.lastName")} *`)}
        </div>
        <div data-field="date_of_birth">
          <Label className={invalid("date_of_birth") ? "text-destructive" : ""}>
            {`${t("case.fields.dateOfBirth")} *`}
          </Label>
          <div className="mt-1 grid grid-cols-3 gap-2">
            <Select value={dobYear} onValueChange={(v) => setDob("year", v)}>
              <SelectTrigger>
                <SelectValue placeholder={t("case.profile.year")} />
              </SelectTrigger>
              <SelectContent className="max-h-48">
                {DOB_YEARS.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dobMonth} onValueChange={(v) => setDob("month", v)}>
              <SelectTrigger>
                <SelectValue placeholder={t("case.profile.month")} />
              </SelectTrigger>
              <SelectContent>
                {DOB_MONTHS.map((m) => (
                  <SelectItem key={m.v} value={m.v}>
                    {m.l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dobDay} onValueChange={(v) => setDob("day", v)}>
              <SelectTrigger>
                <SelectValue placeholder={t("case.profile.day")} />
              </SelectTrigger>
              <SelectContent className="max-h-48">
                {dobDays.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(dobError || invalid("date_of_birth")) && (
            <p className="mt-1 text-xs text-destructive">{dobError ?? errText("date_of_birth")}</p>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label>{t("case.fields.gender")}</Label>
            <Select value={values.gender} onValueChange={(v) => handleChange("gender", v)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={t("case.profile.select")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">{t("case.profile.male")}</SelectItem>
                <SelectItem value="female">{t("case.profile.female")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {field("city_of_birth", t("case.profile.cityOfBirth"))}
        </div>
      </section>

      {/* Contact */}
      <section className="space-y-3 border-t pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("case.profile.sections.contact")}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {field("student_email", `${t("case.fields.studentEmail")} *`, "email", "student@email.com")}
          {field("student_phone", `${t("case.fields.studentPhone")} *`)}
          {field("emergency_contact_name", t("case.profile.emergencyName"))}
          {field("emergency_contact_phone", t("case.profile.emergencyPhone"))}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          {field("street", t("case.fields.street"))}
          {field("house_no", t("case.fields.houseNo"))}
          {field("postcode", t("case.fields.postcode"))}
          {field("city", t("case.fields.city"))}
        </div>
      </section>

      {/* Program */}
      <section className="space-y-3 border-t pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("case.profile.sections.program")}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div data-field="school_id">
            <Label className={invalid("school_id") ? "text-destructive" : ""}>
              {`${t("case.fields.school")} *`}
            </Label>
            <Select
              value={values.school_id}
              onValueChange={(v) => {
                dirty.current = true;
                setErrors((e) => e.filter((f) => f !== "school_id"));
                setValues((prev) => ({
                  ...prev,
                  school_id: v,
                  program_id: "",
                  accommodation_id: "",
                }));
              }}
            >
              <SelectTrigger className={cn("mt-1", invalid("school_id") && "border-destructive")}>
                <SelectValue placeholder={t("case.profile.select")} />
              </SelectTrigger>
              <SelectContent>
                {schools.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {label(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {invalid("school_id") && (
              <p className="mt-1 text-xs text-destructive">{errText("school_id")}</p>
            )}
          </div>
          <div data-field="program_id">
            <Label className={invalid("program_id") ? "text-destructive" : ""}>
              {`${t("case.fields.program")} *`}
            </Label>
            <Select
              value={values.program_id}
              disabled={!values.school_id}
              onValueChange={(v) => handleChange("program_id", v)}
            >
              <SelectTrigger className={cn("mt-1", invalid("program_id") && "border-destructive")}>
                <SelectValue
                  placeholder={
                    values.school_id
                      ? t("case.profile.select")
                      : t("case.profile.pickSchoolFirst", { defaultValue: "Select a school first" })
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {filteredPrograms.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {label(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {invalid("program_id") && (
              <p className="mt-1 text-xs text-destructive">{errText("program_id")}</p>
            )}
          </div>
          <div>
            <Label>{t("case.fields.startMonth")}</Label>
            <Select value={values.start_month} onValueChange={(v) => handleChange("start_month", v)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={t("case.profile.select")} />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                {monthOptions.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("case.fields.arrivalDate")}</Label>
            <Input
              type="date"
              className="mt-1"
              value={values.arrival_date}
              onChange={(e) => handleChange("arrival_date", e.target.value)}
            />
          </div>
          <div data-field="course_start">
            <Label className={invalid("course_start") ? "text-destructive" : ""}>
              {`${t("case.fields.courseStart")} *`}
            </Label>
            <Input
              type="date"
              className={cn("mt-1", invalid("course_start") && "border-destructive")}
              value={values.course_start}
              onChange={(e) => handleChange("course_start", e.target.value)}
            />
            {invalid("course_start") && (
              <p className="mt-1 text-xs text-destructive">{errText("course_start")}</p>
            )}
          </div>
          <div>
            <Label>{t("case.fields.courseEnd")}</Label>
            <Input type="date" className="mt-1 bg-muted" value={values.course_end} readOnly />
            <p className="mt-1 text-xs text-muted-foreground">
              {t("case.profile.autoEnd", { defaultValue: "Calculated automatically — 40 weeks" })}
            </p>
          </div>
          <div data-field="accommodation_id">
            <Label className={invalid("accommodation_id") ? "text-destructive" : ""}>
              {`${t("case.detail.accommodation")} *`}
            </Label>
            <Select
              value={values.accommodation_id}
              disabled={!values.school_id}
              onValueChange={(v) => handleChange("accommodation_id", v)}
            >
              <SelectTrigger
                className={cn("mt-1", invalid("accommodation_id") && "border-destructive")}
              >
                <SelectValue
                  placeholder={
                    values.school_id
                      ? t("case.profile.select")
                      : t("case.profile.pickSchoolFirst", { defaultValue: "Select a school first" })
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {filteredAccoms.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {label(a)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {invalid("accommodation_id") && (
              <p className="mt-1 text-xs text-destructive">{errText("accommodation_id")}</p>
            )}
          </div>
          <div data-field="insurance_id">
            <Label className={invalid("insurance_id") ? "text-destructive" : ""}>
              {`${t("case.detail.insurance")} *`}
            </Label>
            <Select value={values.insurance_id} onValueChange={(v) => handleChange("insurance_id", v)}>
              <SelectTrigger className={cn("mt-1", invalid("insurance_id") && "border-destructive")}>
                <SelectValue placeholder={t("case.profile.select")} />
              </SelectTrigger>
              <SelectContent>
                {insurances.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {invalid("insurance_id") && (
              <p className="mt-1 text-xs text-destructive">{errText("insurance_id")}</p>
            )}
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between gap-3 border-t pt-4">
        <p className="text-xs text-muted-foreground">
          {autosaving
            ? t("case.profile.savingDraft", { defaultValue: "Saving…" })
            : savedLabel
              ? t("case.profile.draftSavedAt", {
                  time: savedLabel,
                  defaultValue: `Draft saved ${savedLabel}`,
                })
              : ""}
        </p>
        <Button onClick={handleSave} disabled={saving} className="gap-1.5">
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : errors.length === 0 && !autosaving ? (
            <Save className="h-4 w-4" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          {t("case.profile.save")}
        </Button>
      </div>
    </div>
  );
}
