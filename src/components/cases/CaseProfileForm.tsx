import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Check, ChevronLeft, ChevronRight, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { generateIntakeMonths } from "@/utils/intakeMonths";
import { DOB_MONTHS, DOB_YEARS, daysInMonth, normalizeDate } from "@/utils/dateUtils";
import { differenceInYears } from "date-fns";
import {
  fullNameOf,
  missingProfileFields,
  normalizeEmail,
  PROFILE_FIELD_LABEL_KEYS,
  readStudentProfile,
  toExtraData,
  type StudentProfileValues,
} from "@/lib/studentProfileFields";
import { computeWeeklyCost, endDateForWeeks, formatMoney } from "@/lib/programPricing";
import { ageFromDob, computeInsuranceCost } from "@/lib/insurancePricing";
import { EDUCATION_LEVEL_VALUES, PASSPORT_TYPE_VALUES } from "@/lib/intakeOptions";
import { cn } from "@/lib/utils";

interface Option {
  id: string;
  name_en: string;
  name_ar: string;
  school_id?: string | null;
  duration_in_months?: number | null;
  fixed_start_day_of_month?: number | null;
  price?: number | null;
  currency?: string | null;
  price_tiers?: unknown;
}

interface Props {
  caseData: Record<string, any>;
  submission: Record<string, any> | null;
  onSaved: () => void;
}

/* ── Steps ──────────────────────────────────────────────────────────── */

const STEP_KEYS = ["stepStudentInfo", "stepContactDetails", "stepProgram"] as const;

type StepNum = 1 | 2 | 3;

const LAST_STEP: StepNum = 3;

/**
 * Stable module-level input.
 *
 * Defining this inside the parent's render body would create a new
 * component type on every render and cause inputs to remount/drop focus.
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
        className={cn("mt-0.5 h-9", invalid && "border-destructive")}
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

/** Same step pill/progress bar used on the Submit New Student wizard. */
const StepBar = ({ step, t, remaining }: { step: StepNum; t: TFunction; remaining?: Record<number, number> }) => (
  <div className="flex items-center gap-1 mb-4">
    {STEP_KEYS.map((key, i) => {
      const n = (i + 1) as StepNum;
      const done = n < step;
      const current = n === step;
      const left = remaining?.[n] ?? 0;

      return (
        <React.Fragment key={n}>
          <div
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all",
              current
                ? "bg-primary text-primary-foreground"
                : done
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {done ? <Check className="h-3 w-3" /> : <span className="w-3 text-center">{n}</span>}

            <span className="hidden sm:inline">{t(`lawyer.submitStudent.${key}`)}</span>

            {left > 0 && (
              <span
                className={cn(
                  "ms-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold",
                  current
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-destructive text-destructive-foreground",
                )}
              >
                {left}
              </span>
            )}
          </div>

          {i < STEP_KEYS.length - 1 && <div className={cn("flex-1 h-px", done ? "bg-emerald-300" : "bg-border")} />}
        </React.Fragment>
      );
    })}
  </div>
);

/** One line of a cost summary box. */
const ReviewRow = ({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) => (
  <div className={cn("flex items-start justify-between gap-4 py-1.5 text-sm", strong && "font-semibold")}>
    <span className="text-muted-foreground shrink-0">{label}</span>

    <span className="text-end break-words">{value}</span>
  </div>
);

/**
 * The profile completion step.
 *
 * Student profile values are kept in one canonical model and persisted to:
 *
 * - case_submissions for submission/program/payment-related values
 * - cases for case-level identity values
 * - case_submissions.extra_data for the shared profile representation
 */
export default function CaseProfileForm({ caseData, submission, onSaved }: Props) {
  const { t, i18n } = useTranslation("dashboard");

  const isAr = i18n.language?.startsWith("ar");

  const { toast } = useToast();
  const { user } = useAuth();

  const ss = (k: string) => t(`lawyer.submitStudent.${k}`);

  const [step, setStep] = useState<StepNum>(1);

  const [values, setValues] = useState<StudentProfileValues>(() => readStudentProfile(caseData, submission));

  const [schools, setSchools] = useState<Option[]>([]);

  const [programs, setPrograms] = useState<Option[]>([]);

  const [accommodations, setAccommodations] = useState<Option[]>([]);

  const [insurances, setInsurances] = useState<
    {
      id: string;
      name: string;
      provider?: string | null;
      price?: number | null;
      currency?: string | null;
      billing_period?: string | null;
      age_price_tiers?: unknown;
    }[]
  >([]);

  const [saving, setSaving] = useState(false);

  const [errors, setErrors] = useState<string[]>([]);

  const [draftSavedAt, setDraftSavedAt] = useState<string | null>((submission?.draft_updated_at as string) ?? null);

  const [autosaving, setAutosaving] = useState(false);

  /**
   * Birth-date dropdown state.
   */
  const [dob, setDobState] = useState(() => {
    const parts = (values.date_of_birth || "").split("-");

    return {
      year: parts[0] ?? "",
      month: parts[1] ?? "",
      day: parts[2] ?? "",
    };
  });

  const [dobError, setDobError] = useState<string | null>(null);

  useEffect(() => {
    const iso = values.date_of_birth || "";

    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      return;
    }

    const [y, m, d] = iso.split("-");

    setDobState((prev) =>
      prev.year === y && prev.month === m && prev.day === d
        ? prev
        : {
            year: y,
            month: m,
            day: d,
          },
    );
  }, [values.date_of_birth]);

  const set = useCallback((key: string, value: string) => {
    setValues((v) => ({
      ...v,
      [key]: value,
    }));
  }, []);

  /*
   * Load catalog data.
   */
  useEffect(() => {
    Promise.all([
      (supabase as any).from("schools").select("id,name_en,name_ar").eq("is_active", true).order("name_en"),

      (supabase as any)
        .from("programs")
        .select("id,name_en,name_ar,school_id,duration_in_months,fixed_start_day_of_month,price,currency,price_tiers")
        .eq("is_active", true)
        .order("name_en"),

      (supabase as any)
        .from("accommodations")
        .select("id,name_en,name_ar,school_id,price,currency,price_tiers")
        .eq("is_active", true),

      (supabase as any)
        .from("insurances")
        .select("id,name,provider,price,currency,billing_period,age_price_tiers")
        .eq("is_active", true),
    ]).then(([sc, p, a, ins]: any[]) => {
      setSchools(sc.data ?? []);
      setPrograms(p.data ?? []);
      setAccommodations(a.data ?? []);
      setInsurances(ins.data ?? []);
    });
  }, []);

  const label = (o: Option) => (isAr ? o.name_ar || o.name_en : o.name_en || o.name_ar);

  const filteredPrograms = useMemo(
    () => (values.school_id ? programs.filter((p) => p.school_id === values.school_id) : []),
    [programs, values.school_id],
  );

  const filteredAccoms = useMemo(
    () => (values.school_id ? accommodations.filter((a) => a.school_id === values.school_id) : []),
    [accommodations, values.school_id],
  );

  const selectedProgram = programs.find((p) => p.id === values.program_id);

  const selectedAccom = accommodations.find((a) => a.id === values.accommodation_id);

  const selectedInsurance = insurances.find((i) => i.id === values.insurance_id);

  const monthOptions = useMemo(() => generateIntakeMonths(24), []);

  const programCost = useMemo(
    () => computeWeeklyCost(selectedProgram as any, parseInt(values.program_weeks) || 0),
    [selectedProgram, values.program_weeks],
  );

  const accomCost = useMemo(
    () => computeWeeklyCost(selectedAccom as any, parseInt(values.accommodation_weeks) || 0),
    [selectedAccom, values.accommodation_weeks],
  );

  const insuranceCost = useMemo(
    () =>
      computeInsuranceCost(
        selectedInsurance as any,
        ageFromDob(values.date_of_birth),
        values.course_start || null,
        values.course_end || null,
      ),
    [selectedInsurance, values.date_of_birth, values.course_start, values.course_end],
  );

  /*
   * Programme start follows the programme's fixed start day.
   */
  useEffect(() => {
    if (!selectedProgram?.fixed_start_day_of_month || !values.start_month) {
      return;
    }

    const [y, m] = values.start_month.split("-").map(Number);

    const d = selectedProgram.fixed_start_day_of_month;

    set("course_start", `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }, [selectedProgram?.fixed_start_day_of_month, values.start_month, set]);

  /*
   * Course end is derived from the number of weeks.
   */
  useEffect(() => {
    const end = endDateForWeeks(values.course_start, parseInt(values.program_weeks) || 0);

    if (end && end !== values.course_end) {
      set("course_end", end);
    }
  }, [values.course_start, values.program_weeks, values.course_end, set]);

  /*
   * ----------------------------------------------------------------------
   * PERSISTENCE
   * ----------------------------------------------------------------------
   */

  const persist = useCallback(
    async (vals: StudentProfileValues, complete: boolean) => {
      const weeks = parseInt(vals.program_weeks) || 0;

      const accomWeeks = parseInt(vals.accommodation_weeks) || 0;

      const progCost = computeWeeklyCost(selectedProgram as any, weeks);

      const accCost = computeWeeklyCost(selectedAccom as any, accomWeeks);

      const payload: Record<string, unknown> = {
        case_id: caseData.id,

        school_id: vals.school_id || null,

        program_id: vals.program_id || null,

        accommodation_id: vals.accommodation_id || null,

        insurance_id: vals.insurance_id || null,

        program_start_date: vals.course_start || null,

        program_end_date: endDateForWeeks(vals.course_start, weeks) || null,

        program_weeks: progCost.weeks || null,

        program_weekly_price: progCost.weeklyRate,

        program_price: progCost.total,

        accommodation_weeks: accCost.weeks || null,

        accommodation_weekly_price: accCost.weeklyRate,

        accommodation_price: accCost.total,

        insurance_price: insuranceCost.total ?? null,

        student_email: normalizeEmail(vals.student_email) || null,

        student_phone: vals.student_phone?.trim() || null,

        extra_data: toExtraData(vals, (submission?.extra_data as Record<string, unknown>) ?? {}),

        draft_updated_at: new Date().toISOString(),
      };

      if (complete) {
        payload.profile_completed_at = new Date().toISOString();
      }

      const { error } = await (supabase as any).from("case_submissions").upsert(payload, {
        onConflict: "case_id",
      });

      if (error) {
        throw error;
      }

      return payload.draft_updated_at as string;
    },
    [caseData.id, submission, selectedProgram, selectedAccom, insuranceCost],
  );

  /*
   * Dirty state + autosave.
   */
  const dirty = useRef(false);

  const timer = useRef<number | null>(null);

  /*
   * Whenever a new value changes, schedule a draft save.
   */
  useEffect(() => {
    if (!dirty.current) {
      return;
    }

    if (timer.current !== null) {
      window.clearTimeout(timer.current);
    }

    timer.current = window.setTimeout(() => {
      timer.current = null;

      /*
       * Do not start another autosave while the explicit Save button
       * is currently persisting the same data.
       */
      if (saving) {
        return;
      }

      setAutosaving(true);

      persist(values, false)
        .then((at) => {
          setDraftSavedAt(at);
        })
        .catch(() => {
          /*
           * Autosave errors stay silent.
           * Explicit Save exposes the real error.
           */
        })
        .finally(() => {
          setAutosaving(false);
        });
    }, 1200);

    return () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
    };
  }, [values, persist, saving]);

  /*
   * Keep the freshest values available if the component unmounts.
   */
  const latest = useRef({
    values,
    persist,
  });

  latest.current = {
    values,
    persist,
  };

  /*
   * If the form is unmounted while an autosave is pending,
   * flush the latest draft.
   */
  useEffect(
    () => () => {
      if (!dirty.current || timer.current === null) {
        return;
      }

      window.clearTimeout(timer.current);

      timer.current = null;

      void latest.current.persist(latest.current.values, false).catch(() => {});
    },
    [],
  );

  const handleChange = useCallback(
    (name: string, value: string) => {
      dirty.current = true;

      set(name, value);

      setErrors((e) => e.filter((f) => f !== name));
    },
    [set],
  );

  const fieldName = (f: string) => t(PROFILE_FIELD_LABEL_KEYS[f as keyof StudentProfileValues] ?? f);

  /*
   * ----------------------------------------------------------------------
   * VALIDATION
   * ----------------------------------------------------------------------
   */

  const validateStep = (s: StepNum): string[] => {
    const missing: string[] = [];

    if (s === 1) {
      if (!values.first_name.trim()) {
        missing.push("first_name");
      }

      if (!values.last_name.trim()) {
        missing.push("last_name");
      }

      if (!values.date_of_birth.trim()) {
        missing.push("date_of_birth");
      }
    }

    if (s === 2) {
      const allMissing = missingProfileFields(values);

      if (allMissing.includes("student_email")) {
        missing.push("student_email");
      }

      if (allMissing.includes("student_phone")) {
        missing.push("student_phone");
      }
    }

    if (s === 3) {
      if (!values.school_id) {
        missing.push("school_id");
      }

      if (!values.program_id) {
        missing.push("program_id");
      }

      if (values.program_id && !values.program_weeks.trim()) {
        missing.push("program_weeks");
      }

      if (!values.accommodation_id) {
        missing.push("accommodation_id");
      }

      if (values.accommodation_id && !values.accommodation_weeks.trim()) {
        missing.push("accommodation_weeks");
      }

      if (!values.insurance_id) {
        missing.push("insurance_id");
      }

      if (!values.course_start.trim()) {
        missing.push("course_start");
      }
    }

    return missing;
  };

  const goNext = () => {
    const missing = validateStep(step);

    if (missing.length > 0) {
      setErrors(missing);

      const el = document.querySelector(`[data-field="${missing[0]}"]`);

      el?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });

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

    setErrors([]);

    setStep((s) => Math.min(s + 1, LAST_STEP) as StepNum);
  };

  const goBack = () => {
    setErrors([]);

    setStep((s) => Math.max(s - 1, 1) as StepNum);
  };

  /*
   * ----------------------------------------------------------------------
   * EXPLICIT SAVE
   * ----------------------------------------------------------------------
   */

  const handleSave = async () => {
    const missing = missingProfileFields(values) as string[];

    if (missing.length > 0) {
      setErrors(missing);

      const step1Fields = ["first_name", "last_name", "date_of_birth"];

      const step2Fields = ["student_email", "student_phone"];

      const owningStep: StepNum = step1Fields.includes(missing[0]) ? 1 : step2Fields.includes(missing[0]) ? 2 : 3;

      setStep(owningStep);

      setTimeout(() => {
        const el = document.querySelector(`[data-field="${missing[0]}"]`);

        el?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });

        (el?.querySelector("input, button") as HTMLElement | null)?.focus();
      }, 0);

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

    /*
     * Cancel any pending autosave before the authoritative save.
     */
    if (timer.current !== null) {
      window.clearTimeout(timer.current);

      timer.current = null;
    }

    setSaving(true);

    try {
      /*
       * Save the complete profile to case_submissions first.
       */
      const at = await persist(values, true);

      setDraftSavedAt(at);

      /*
       * Mirror case-level identity fields.
       *
       * These are intentionally stored on cases because the pipeline,
       * admin views and case-level UI read them from there.
       */
      const name = fullNameOf(values);

      const casePatch: Record<string, unknown> = {
        phone_number: values.student_phone?.trim() || null,

        city: values.city?.trim() || null,

        education_level: values.education_level || null,

        passport_type: values.passport_type || null,
      };

      if (name && name !== caseData.full_name) {
        casePatch.full_name = name;
      }

      const { error: caseError } = await supabase.from("cases").update(casePatch).eq("id", caseData.id);

      if (caseError) {
        throw caseError;
      }

      /*
       * Synchronise the student's profile row where applicable.
       */
      const studentUserId = (
        caseData as {
          student_user_id?: string | null;
        }
      ).student_user_id;

      if (studentUserId) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            full_name: name || undefined,

            email: normalizeEmail(values.student_email) || undefined,

            phone_number: values.student_phone?.trim() || undefined,

            date_of_birth: values.date_of_birth || undefined,

            gender: values.gender || undefined,

            city: values.city?.trim() || undefined,

            emergency_contact_name: values.emergency_contact_name?.trim() || undefined,

            emergency_contact_phone: values.emergency_contact_phone?.trim() || undefined,

            arrival_date: values.arrival_date || undefined,

            intake_month: values.start_month || undefined,
          })
          .eq("id", studentUserId);

        /*
         * Profile synchronization is best-effort because the current
         * project intentionally protects profile columns with its own
         * authorization rules.
         */
        if (profileError) {
          console.warn("profile sync skipped:", profileError.message);
        }
      }

      /*
       * Audit event.
       */
      await supabase.rpc("log_case_event", {
        p_case_id: caseData.id,

        p_event_type: "profile_updated",

        p_payload: {
          by: user?.id ?? null,
        },

        p_is_internal: true,
      });

      /*
       * The explicit save is now authoritative.
       * Do not leave the form dirty.
       */
      dirty.current = false;

      toast({
        description: t("case.profile.saved"),
      });

      /*
       * Refresh the parent data after the successful save.
       */
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

  const invalid = (f: keyof StudentProfileValues) => errors.includes(f as string);

  const errText = (_f: keyof StudentProfileValues) =>
    t("case.profile.fieldRequired", {
      defaultValue: "This field is required",
    });

  const field = (name: keyof StudentProfileValues, labelText: string, type?: string, placeholder?: string) => (
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

  /*
   * ----------------------------------------------------------------------
   * DOB
   * ----------------------------------------------------------------------
   */

  const dobYear = dob.year;

  const dobMonth = dob.month;

  const dobDay = dob.day;

  const dobDays = Array.from(
    {
      length: dobMonth ? daysInMonth(parseInt(dobMonth), parseInt(dobYear) || 2000) : 31,
    },
    (_, i) => String(i + 1).padStart(2, "0"),
  );

  const setDob = (part: "year" | "month" | "day", v: string) => {
    setDobState((prev) => {
      const next = {
        ...prev,
        [part]: v,
      };

      if (next.month) {
        const max = daysInMonth(parseInt(next.month), parseInt(next.year) || 2000);

        if (next.day && parseInt(next.day) > max) {
          next.day = String(max).padStart(2, "0");
        }
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

  const dobAge =
    dobYear && dobMonth && dobDay ? differenceInYears(new Date(), new Date(`${dobYear}-${dobMonth}-${dobDay}`)) : null;

  /*
   * ----------------------------------------------------------------------
   * DRAFT STATUS
   * ----------------------------------------------------------------------
   */

  const savedLabel = draftSavedAt
    ? new Date(draftSavedAt).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const draftStatus = autosaving
    ? t("case.profile.savingDraft", {
        defaultValue: "Saving…",
      })
    : savedLabel
      ? t("case.profile.draftSavedAt", {
          time: savedLabel,
          defaultValue: `Draft saved ${savedLabel}`,
        })
      : "";

  const remainingByStep: Record<number, number> = {
    1: validateStep(1).length,
    2: validateStep(2).length,
    3: validateStep(3).length,
  };

  return (
    <div className="space-y-4">
      <StepBar step={step} t={t} remaining={remainingByStep} />

      {/* ══ STEP 1: Student Info ══ */}

      {step === 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{ss("studentInfo")}</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="grid md:grid-cols-3 gap-x-4 gap-y-3">
              {field("first_name", `${ss("firstName")} *`)}

              {field("middle_name", ss("middleName"))}

              {field("last_name", `${ss("lastName")} *`)}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3">
              <div data-field="date_of_birth">
                <Label className={invalid("date_of_birth") ? "text-destructive" : ""}>{ss("dateOfBirth")}</Label>

                <div className="grid grid-cols-3 gap-2 mt-0.5">
                  <Select value={dobYear} onValueChange={(v) => setDob("year", v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={ss("year")} />
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
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={ss("month")} />
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
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder={ss("day")} />
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

                {dobAge !== null && !isNaN(dobAge) && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {ss("ageYears")
                      ? t("lawyer.submitStudent.ageYears", {
                          age: dobAge,
                        })
                      : `${dobAge}`}
                  </p>
                )}

                {(dobError || invalid("date_of_birth")) && (
                  <p className="mt-0.5 text-xs text-destructive">{dobError ?? errText("date_of_birth")}</p>
                )}
              </div>

              <div>
                <Label>{t("case.fields.gender")}</Label>

                <Select value={values.gender} onValueChange={(v) => handleChange("gender", v)}>
                  <SelectTrigger className="mt-0.5 h-9">
                    <SelectValue placeholder={ss("genderSelect")} />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="male">{ss("genderMale")}</SelectItem>

                    <SelectItem value="female">{ss("genderFemale")}</SelectItem>

                    <SelectItem value="other">{ss("genderOther")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {field("city_of_birth", ss("cityOfBirth"))}
            </div>

            {/* Education + passport are canonical case fields and are also
                preserved inside extra_data for the shared profile model. */}

            <div className="grid md:grid-cols-2 gap-x-4 gap-y-3">
              <div>
                <Label>{ss("educationLevel")}</Label>

                <Select value={values.education_level} onValueChange={(v) => handleChange("education_level", v)}>
                  <SelectTrigger className="mt-0.5 h-9">
                    <SelectValue placeholder={ss("educationLevelSelect")} />
                  </SelectTrigger>

                  <SelectContent>
                    {EDUCATION_LEVEL_VALUES.map((v) => (
                      <SelectItem key={v} value={v}>
                        {t(`case.educationLevels.${v}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{ss("passportType")}</Label>

                <Select value={values.passport_type} onValueChange={(v) => handleChange("passport_type", v)}>
                  <SelectTrigger className="mt-0.5 h-9">
                    <SelectValue placeholder={ss("passportTypeSelect")} />
                  </SelectTrigger>

                  <SelectContent>
                    {PASSPORT_TYPE_VALUES.map((v) => (
                      <SelectItem key={v} value={v}>
                        {t(`case.passportTypes.${v}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <p className="text-xs text-muted-foreground">{draftStatus}</p>

              <Button onClick={goNext}>
                {ss("next")}
                <ChevronRight className="h-4 w-4 ms-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ══ STEP 2: Contact Details ══ */}

      {step === 2 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{ss("stepContactDetails")}</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3">
              {field("student_email", `${ss("email")} *`, "email", "student@email.com")}

              {field("student_phone", `${ss("phone")} *`, "text", "+972...")}

              {field("emergency_contact_name", ss("emergencyName"))}

              {field("emergency_contact_phone", ss("emergencyPhone"), "text", "+972...")}
            </div>

            <div>
              <Label>{ss("address")}</Label>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mt-0.5">
                <Input
                  className="h-9"
                  placeholder={ss("street")}
                  value={values.street}
                  onChange={(e) => handleChange("street", e.target.value)}
                />

                <Input
                  className="h-9"
                  placeholder={ss("houseNo")}
                  value={values.house_no}
                  onChange={(e) => handleChange("house_no", e.target.value)}
                />

                <Input
                  className="h-9"
                  placeholder={ss("postcode")}
                  value={values.postcode}
                  onChange={(e) => handleChange("postcode", e.target.value)}
                />

                <Input
                  className="h-9"
                  placeholder={ss("city")}
                  value={values.city}
                  onChange={(e) => handleChange("city", e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <Button variant="outline" onClick={goBack}>
                <ChevronLeft className="h-4 w-4 me-1" />
                {ss("back")}
              </Button>

              <p className="text-xs text-muted-foreground hidden sm:block">{draftStatus}</p>

              <Button onClick={goNext}>
                {ss("next")}
                <ChevronRight className="h-4 w-4 ms-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ══ STEP 3 ══ */}

      {step === 3 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{ss("stepProgram")}</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-3">
              <div data-field="school_id">
                <Label className={invalid("school_id") ? "text-destructive" : ""}>{`${ss("school")} *`}</Label>

                <Select
                  value={values.school_id}
                  onValueChange={(v) => {
                    dirty.current = true;

                    setErrors((e) => e.filter((f) => f !== "school_id"));

                    setValues((prev) => ({
                      ...prev,

                      school_id: v,

                      program_id: "",

                      program_weeks: "",

                      accommodation_id: "",

                      accommodation_weeks: "",

                      start_month: "",

                      course_start: "",

                      course_end: "",
                    }));
                  }}
                >
                  <SelectTrigger className={cn("mt-0.5 h-9", invalid("school_id") && "border-destructive")}>
                    <SelectValue placeholder={ss("selectSchool")} />
                  </SelectTrigger>

                  <SelectContent>
                    {schools.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {label(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {invalid("school_id") && <p className="mt-0.5 text-xs text-destructive">{errText("school_id")}</p>}
              </div>

              <div data-field="program_id">
                <Label className={invalid("program_id") ? "text-destructive" : ""}>{`${ss("program")} *`}</Label>

                <Select
                  value={values.program_id}
                  disabled={!values.school_id}
                  onValueChange={(v) => handleChange("program_id", v)}
                >
                  <SelectTrigger className={cn("mt-0.5 h-9", invalid("program_id") && "border-destructive")}>
                    <SelectValue
                      placeholder={
                        !values.school_id
                          ? ss("selectSchoolFirst")
                          : filteredPrograms.length === 0
                            ? ss("noProgramsForSchool")
                            : ss("selectProgram")
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

                {invalid("program_id") && <p className="mt-0.5 text-xs text-destructive">{errText("program_id")}</p>}
              </div>

              <div data-field="program_weeks">
                <Label className={invalid("program_weeks") ? "text-destructive" : ""}>{ss("programWeeks")}</Label>

                <Input
                  className={cn("mt-0.5 h-9", invalid("program_weeks") && "border-destructive")}
                  type="number"
                  min="1"
                  max="104"
                  value={values.program_weeks}
                  onChange={(e) => handleChange("program_weeks", e.target.value)}
                  disabled={!values.program_id}
                  placeholder="40"
                />

                {invalid("program_weeks") && (
                  <p className="mt-0.5 text-xs text-destructive">{errText("program_weeks")}</p>
                )}
              </div>
            </div>

            {selectedProgram && programCost.weeklyRate !== null && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
                <span className="text-muted-foreground">
                  {ss("weeklyPrice")}: {formatMoney(programCost.weeklyRate, programCost.currency)}
                </span>
                <span className="text-muted-foreground">
                  {ss("weeks")}: {programCost.weeks || "—"}
                </span>
                <span className="font-semibold ms-auto">
                  {ss("programTotal")}: {formatMoney(programCost.total, programCost.currency)}
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3">
              <div>
                <Label>{ss("intakeMonth")}</Label>

                <Select value={values.start_month} onValueChange={(v) => handleChange("start_month", v)}>
                  <SelectTrigger className="mt-0.5 h-9">
                    <SelectValue placeholder={ss("selectIntakeMonth")} />
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
                <Label>{ss("arrivalDate")}</Label>

                <Input
                  type="date"
                  className="mt-0.5 h-9"
                  value={values.arrival_date}
                  onChange={(e) => handleChange("arrival_date", e.target.value)}
                />
              </div>

              <div data-field="course_start">
                <Label className={invalid("course_start") ? "text-destructive" : ""}>{`${ss("courseStart")} *`}</Label>

                <Input
                  type="date"
                  className={cn("mt-0.5 h-9", invalid("course_start") && "border-destructive")}
                  value={values.course_start}
                  onChange={(e) => handleChange("course_start", e.target.value)}
                />

                {invalid("course_start") && (
                  <p className="mt-0.5 text-xs text-destructive">{errText("course_start")}</p>
                )}
              </div>

              <div>
                <Label>{ss("courseEnd")}</Label>

                <div
                  className={cn(
                    "mt-0.5 flex items-center h-9 px-3 rounded-md border text-sm bg-muted/30",
                    values.course_end ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {values.course_end || ss("autoCalc")}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-3">
              <div data-field="accommodation_id">
                <Label className={invalid("accommodation_id") ? "text-destructive" : ""}>
                  {`${t("case.detail.accommodation")} *`}{" "}
                  {!values.school_id && (
                    <span className="text-muted-foreground text-xs">({ss("selectSchoolFirst")})</span>
                  )}
                </Label>

                <Select
                  value={values.accommodation_id}
                  disabled={!values.school_id}
                  onValueChange={(v) => handleChange("accommodation_id", v)}
                >
                  <SelectTrigger className={cn("mt-0.5 h-9", invalid("accommodation_id") && "border-destructive")}>
                    <SelectValue
                      placeholder={
                        filteredAccoms.length === 0
                          ? values.school_id
                            ? ss("noAccomForSchool")
                            : ss("selectSchoolFirst")
                          : ss("selectAccom")
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
                  <p className="mt-0.5 text-xs text-destructive">{errText("accommodation_id")}</p>
                )}
              </div>

              <div data-field="accommodation_weeks">
                <Label className={invalid("accommodation_weeks") ? "text-destructive" : ""}>
                  {ss("accommodationWeeks")}
                </Label>

                <Input
                  className={cn("mt-0.5 h-9", invalid("accommodation_weeks") && "border-destructive")}
                  type="number"
                  min="1"
                  max="104"
                  value={values.accommodation_weeks}
                  onChange={(e) => handleChange("accommodation_weeks", e.target.value)}
                  disabled={!values.accommodation_id}
                  placeholder={values.program_weeks || "40"}
                />

                {invalid("accommodation_weeks") && (
                  <p className="mt-0.5 text-xs text-destructive">{errText("accommodation_weeks")}</p>
                )}
              </div>

              <div data-field="insurance_id">
                <Label className={invalid("insurance_id") ? "text-destructive" : ""}>
                  {`${t("case.detail.insurance")} *`}
                </Label>

                <Select value={values.insurance_id} onValueChange={(v) => handleChange("insurance_id", v)}>
                  <SelectTrigger className={cn("mt-0.5 h-9", invalid("insurance_id") && "border-destructive")}>
                    <SelectValue placeholder={ss("selectInsurance")} />
                  </SelectTrigger>{" "}
                  <SelectContent>
                    {insurances.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.name}
                        {i.provider ? ` — ${i.provider}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {invalid("insurance_id") && (
                  <p className="mt-0.5 text-xs text-destructive">{errText("insurance_id")}</p>
                )}

                {selectedInsurance && insuranceCost.total !== null && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatMoney(insuranceCost.total, selectedInsurance.currency ?? "EUR")}
                    {insuranceCost.months
                      ? ` · ${insuranceCost.months} × ${formatMoney(
                          insuranceCost.monthly ?? 0,
                          selectedInsurance.currency ?? "EUR",
                        )}`
                      : ""}
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t mt-2">
              <Button variant="outline" onClick={goBack} className="w-full sm:w-auto">
                <ChevronLeft className="h-4 w-4 me-1" />
                {ss("back")}
              </Button>

              <p className="text-xs text-muted-foreground text-center sm:text-start">{draftStatus}</p>

              <Button onClick={handleSave} disabled={saving} className="gap-1.5 w-full sm:w-auto">
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
