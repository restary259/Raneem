import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { addMonths, format } from "date-fns";
import { Loader2, Save } from "lucide-react";
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
  fullNameOf,
  missingProfileFields,
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
 * The profile completion step. Field-for-field identical to the
 * "+ New student" form, prefilled from whatever the case already knows.
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

  const set = <K extends keyof StudentProfileValues>(key: K, value: StudentProfileValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

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
  const filteredPrograms = useMemo(
    () => programs.filter((p) => !values.school_id || p.school_id === values.school_id),
    [programs, values.school_id],
  );
  const filteredAccoms = useMemo(
    () => accommodations.filter((a) => !values.school_id || a.school_id === values.school_id),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProgram?.fixed_start_day_of_month, values.start_month]);

  // Course end follows the programme duration.
  useEffect(() => {
    if (!selectedProgram?.duration_in_months || !values.course_start) return;
    const end = addMonths(new Date(values.course_start), selectedProgram.duration_in_months);
    set("course_end", format(end, "yyyy-MM-dd"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProgram?.duration_in_months, values.course_start]);

  const handleSave = async () => {
    const missing = missingProfileFields(values);
    setErrors(missing as string[]);
    if (missing.length > 0) {
      toast({ variant: "destructive", description: t("case.profile.missingFields") });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        case_id: caseData.id,
        program_id: values.program_id || null,
        accommodation_id: values.accommodation_id || null,
        insurance_id: values.insurance_id || null,
        program_start_date: values.course_start || null,
        program_end_date: values.course_end || null,
        extra_data: toExtraData(values, (submission?.extra_data as Record<string, unknown>) ?? {}),
      };

      if (submission?.id) {
        const { error } = await (supabase as any)
          .from("case_submissions")
          .update(payload)
          .eq("id", submission.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("case_submissions").insert(payload);
        if (error) throw error;
      }

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

  const Field = ({
    field,
    labelText,
    type = "text",
    placeholder,
  }: {
    field: keyof StudentProfileValues;
    labelText: string;
    type?: string;
    placeholder?: string;
  }) => (
    <div>
      <Label className={invalid(field) ? "text-destructive" : ""}>{labelText}</Label>
      <Input
        className={cn("mt-1", invalid(field) && "border-destructive")}
        type={type}
        value={values[field] as string}
        placeholder={placeholder}
        onChange={(e) => set(field, e.target.value as StudentProfileValues[typeof field])}
      />
    </div>
  );

  const dobParts = values.date_of_birth.split("-");
  const dobYear = dobParts[0] ?? "";
  const dobMonth = dobParts[1] ?? "";
  const dobDay = dobParts[2] ?? "";
  const setDob = (y: string, m: string, d: string) => {
    if (!y || !m || !d) return;
    try {
      set("date_of_birth", normalizeDate(d, m, y));
    } catch {
      /* ignore invalid intermediate values */
    }
  };
  const dobDays = Array.from({ length: daysInMonth(parseInt(dobMonth), parseInt(dobYear)) }, (_, i) =>
    String(i + 1).padStart(2, "0"),
  );

  return (
    <div className="space-y-6">
      {/* Student info */}
      <section className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("case.profile.sections.student")}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field field="first_name" labelText={`${t("case.fields.firstName")} *`} />
          <Field field="middle_name" labelText={t("case.fields.middleName")} />
          <Field field="last_name" labelText={`${t("case.fields.lastName")} *`} />
        </div>
        <div>
          <Label className={invalid("date_of_birth") ? "text-destructive" : ""}>
            {`${t("case.fields.dateOfBirth")} *`}
          </Label>
          <div className="mt-1 grid grid-cols-3 gap-2">
            <Select value={dobYear} onValueChange={(v) => setDob(v, dobMonth, dobDay)}>
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
            <Select value={dobMonth} onValueChange={(v) => setDob(dobYear, v, dobDay)}>
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
            <Select value={dobDay} onValueChange={(v) => setDob(dobYear, dobMonth, v)}>
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
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label>{t("case.fields.gender")}</Label>
            <Select value={values.gender} onValueChange={(v) => set("gender", v)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={t("case.profile.select")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">{t("case.profile.male")}</SelectItem>
                <SelectItem value="female">{t("case.profile.female")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Field field="city_of_birth" labelText={t("case.profile.cityOfBirth")} />
        </div>
      </section>

      {/* Contact */}
      <section className="space-y-3 border-t pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("case.profile.sections.contact")}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            field="student_email"
            labelText={`${t("case.fields.studentEmail")} *`}
            type="email"
            placeholder="student@email.com"
          />
          <Field field="student_phone" labelText={`${t("case.fields.studentPhone")} *`} />
          <Field field="emergency_contact_name" labelText={t("case.profile.emergencyName")} />
          <Field field="emergency_contact_phone" labelText={t("case.profile.emergencyPhone")} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Field field="street" labelText={t("case.fields.street")} />
          <Field field="house_no" labelText={t("case.fields.houseNo")} />
          <Field field="postcode" labelText={t("case.fields.postcode")} />
          <Field field="city" labelText={t("case.fields.city")} />
        </div>
      </section>

      {/* Program */}
      <section className="space-y-3 border-t pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("case.profile.sections.program")}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label>{t("case.fields.school")}</Label>
            <Select
              value={values.school_id}
              onValueChange={(v) => {
                set("school_id", v);
                set("program_id", "");
                set("accommodation_id", "");
              }}
            >
              <SelectTrigger className="mt-1">
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
          </div>
          <div>
            <Label className={invalid("program_id") ? "text-destructive" : ""}>
              {`${t("case.fields.program")} *`}
            </Label>
            <Select value={values.program_id} onValueChange={(v) => set("program_id", v)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={t("case.profile.select")} />
              </SelectTrigger>
              <SelectContent>
                {filteredPrograms.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {label(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("case.fields.startMonth")}</Label>
            <Select value={values.start_month} onValueChange={(v) => set("start_month", v)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={t("case.profile.select")} />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                {monthOptions.map((m: any) => (
                  <SelectItem key={m.value ?? m} value={m.value ?? m}>
                    {m.label ?? m}
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
              onChange={(e) => set("arrival_date", e.target.value)}
            />
          </div>
          <div>
            <Label className={invalid("course_start") ? "text-destructive" : ""}>
              {`${t("case.fields.courseStart")} *`}
            </Label>
            <Input
              type="date"
              className={cn("mt-1", invalid("course_start") && "border-destructive")}
              value={values.course_start}
              onChange={(e) => set("course_start", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("case.fields.courseEnd")}</Label>
            <Input
              type="date"
              className="mt-1"
              value={values.course_end}
              onChange={(e) => set("course_end", e.target.value)}
            />
          </div>
          <div>
            <Label>{t("case.detail.accommodation")}</Label>
            <Select value={values.accommodation_id} onValueChange={(v) => set("accommodation_id", v)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={t("case.profile.select")} />
              </SelectTrigger>
              <SelectContent>
                {filteredAccoms.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {label(a)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("case.detail.insurance")}</Label>
            <Select value={values.insurance_id} onValueChange={(v) => set("insurance_id", v)}>
              <SelectTrigger className="mt-1">
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
          </div>
        </div>
      </section>

      <div className="flex justify-end border-t pt-4">
        <Button onClick={handleSave} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t("case.profile.save")}
        </Button>
      </div>
    </div>
  );
}
