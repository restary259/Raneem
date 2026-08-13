import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format, addMonths } from "date-fns";
import { Loader2, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { DOB_MONTHS, DOB_YEARS, normalizeDate, daysInMonth, ageFromISO, parseISODate } from "@/utils/dateUtils";
import { useFormDraft } from "@/hooks/useFormDraft";
import { DraftStatus } from "@/components/common/DraftStatus";
import { checkEmailAvailability } from "@/lib/checkEmailAvailability";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db: any = supabase as unknown as any;

/* ─── Types ─────────────────────────────────────────────────────────── */
interface Program {
  id: string;
  name_en: string;
  name_ar: string;
  type: string;
  duration_in_months: number | null;
  fixed_start_day_of_month: number | null;
  lessons_per_week: number | null;
  price: number | null;
  currency: string;
}
interface School {
  id: string;
  name_en: string;
  name_ar: string;
  city: string | null;
}
interface Accommodation {
  id: string;
  name_en: string;
  name_ar: string;
  price: number | null;
  currency: string;
  school_id: string | null;
}
interface Insurance {
  id: string;
  name: string;
  tier: string;
  price: number;
  currency: string;
}
interface CaseData {
  city?: string | null;
  education_level?: string | null;
  bagrut_score?: number | null;
  english_level?: string | null;
  math_units?: number | null;
  passport_type?: string | null;
  degree_interest?: string | null;
  intake_notes?: string | null;
}
interface Props {
  caseId: string;
  actorId: string;
  actorName: string;
  existingData?: Record<string, unknown>;
  caseData?: CaseData;
  onSuccess: () => void;
}

const STEP_KEYS = ["personal", "contact", "program", "accommodation", "review"] as const;
type StepKey = (typeof STEP_KEYS)[number];

/** Picks the Arabic name when the UI is Arabic, falling back to English. */
export function localizedName(row: { name_ar?: string | null; name_en?: string | null } | undefined, isAr: boolean) {
  if (!row) return "";
  return (isAr ? row.name_ar || row.name_en : row.name_en || row.name_ar) ?? "";
}

/* ══════════════════════════════════════════════════════════════════════
   MODULE-LEVEL COMPONENTS
   Defined outside the parent so they never remount on state changes.
══════════════════════════════════════════════════════════════════════ */

/** Inline error wrapper — does NOT contain an <Input>, just wraps children */
const FieldWrap = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
  <div>
    <Label className={error ? "text-destructive" : ""}>{label}</Label>
    {children}
    {error && <p className="text-xs text-destructive mt-1">{error}</p>}
  </div>
);

/**
 * Fixed BirthdayPicker — ISO string based, independent partial state.
 * Selecting Year does NOT pre-fill Day to "01" until user explicitly picks a day.
 */
const BirthdayPicker = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string; // ISO "YYYY-MM-DD" or ""
  onChange: (iso: string) => void;
}) => {
  const { t } = useTranslation("dashboard");
  const parsed = parseISODate(value);
  const [selYear, setSelYear] = useState(parsed.year);
  const [selMonth, setSelMonth] = useState(parsed.month);
  const [selDay, setSelDay] = useState(parsed.day);

  // Sync inward when value prop changes externally
  useEffect(() => {
    const p = parseISODate(value);
    setSelYear(p.year);
    setSelMonth(p.month);
    setSelDay(p.day);
  }, [value]);

  const numDays = daysInMonth(Number(selMonth), Number(selYear));
  const days = Array.from({ length: numDays }, (_, i) => String(i + 1).padStart(2, "0"));

  const tryEmit = (y: string, m: string, d: string) => {
    if (!y || !m || !d) return;
    try {
      onChange(normalizeDate(d, m, y));
    } catch {
      // invalid combo — wait for user to correct
    }
  };

  const handleYear = (y: string) => {
    setSelYear(y);
    tryEmit(y, selMonth, selDay);
  };
  const handleMonth = (m: string) => {
    setSelMonth(m);
    // Clamp day if out of range for new month
    const maxD = daysInMonth(Number(m), Number(selYear));
    const clampedDay = selDay && Number(selDay) > maxD ? String(maxD).padStart(2, "0") : selDay;
    if (clampedDay !== selDay) setSelDay(clampedDay);
    tryEmit(selYear, m, clampedDay);
  };
  const handleDay = (d: string) => {
    setSelDay(d);
    tryEmit(selYear, selMonth, d);
  };

  const age = ageFromISO(value);
  return (
    <div>
      <Label>{label}</Label>
      <div className="grid grid-cols-3 gap-2 mt-1">
        <Select value={selYear} onValueChange={handleYear}>
          <SelectTrigger><SelectValue placeholder={t("case.profileForm.ph.year")} /></SelectTrigger>
          <SelectContent className="max-h-48">
            {DOB_YEARS.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selMonth} onValueChange={handleMonth}>
          <SelectTrigger><SelectValue placeholder={t("case.profileForm.ph.month")} /></SelectTrigger>
          <SelectContent>
            {DOB_MONTHS.map((m) => (
              <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selDay} onValueChange={handleDay}>
          <SelectTrigger><SelectValue placeholder={t("case.profileForm.ph.day")} /></SelectTrigger>
          <SelectContent className="max-h-48">
            {days.map((d) => (
              <SelectItem key={d} value={d}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {age !== null && (
        <p className="text-xs text-muted-foreground mt-1">{t("case.profileForm.age", { count: age })}</p>
      )}
    </div>
  );
};

/** Simple date input using native <input type="date"> — no pointer-event issues in modals */
const DateField = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string; // ISO "YYYY-MM-DD" or ""
  onChange: (iso: string) => void;
}) => (
  <div>
    <Label>{label}</Label>
    <Input
      type="date"
      className="mt-1"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

/* ══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════ */
export default function ProfileCompletionForm({
  caseId,
  actorId,
  actorName,
  existingData,
  caseData: cd,
  onSuccess,
}: Props) {
  const { toast } = useToast();
  const { t, i18n } = useTranslation("dashboard");
  const isAr = i18n.language === "ar";
  const nameOf = (row: { name_ar?: string | null; name_en?: string | null } | undefined) => localizedName(row, isAr);

  const [programs, setPrograms] = useState<Program[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [insurances, setInsurances] = useState<Insurance[]>([]);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<StepKey>("personal");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const ex = existingData ?? {};
  const readEmail = (ex.student_email ?? ex.email ?? "") as string;
  const readPhone = (ex.student_phone ?? ex.phone ?? "") as string;

  // Personal
  const [firstName, setFirstName] = useState((ex.first_name as string) ?? "");
  const [middleName, setMiddleName] = useState((ex.middle_name as string) ?? "");
  const [lastName, setLastName] = useState((ex.last_name as string) ?? "");
  const [dob, setDob] = useState<string>((ex.date_of_birth as string) ?? "");
  const [gender, setGender] = useState((ex.gender as string) ?? "");
  const [cityOfBirth, setCityOfBirth] = useState((ex.city_of_birth as string) ?? "");

  // Contact
  const [email, setEmail] = useState(readEmail);
  const [phone, setPhone] = useState(readPhone);
  // Email already belongs to an existing account (caught before submit so we
  // never send a dead activation link that accept-invitation will reject).
  const [emailTaken, setEmailTaken] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const emailCheckSeq = useRef(0);
  const [emergencyName, setEmergencyName] = useState((ex.emergency_contact_name as string) ?? "");
  const [emergencyPhone, setEmergencyPhone] = useState((ex.emergency_contact_phone as string) ?? "");
  const [street, setStreet] = useState((ex.street as string) ?? "");
  const [houseNo, setHouseNo] = useState((ex.house_no as string) ?? "");
  const [postcode, setPostcode] = useState((ex.postcode as string) ?? "");
  const [city, setCity] = useState((ex.city as string) ?? cd?.city ?? "");

  // Program
  const [programId, setProgramId] = useState((ex.program_id as string) ?? "");
  const [schoolId, setSchoolId] = useState((ex.school_id as string) ?? "");
  const [startMonth, setStartMonth] = useState((ex.start_month as string) ?? "");
  const [arrivalDate, setArrivalDate] = useState<string>((ex.arrival_date as string) ?? "");
  const [courseStart, setCourseStart] = useState<string>((ex.course_start as string) ?? "");
  const [courseEnd, setCourseEnd] = useState<string>((ex.course_end as string) ?? "");

  // Accommodation
  const [accommodationId, setAccommodationId] = useState((ex.accommodation_id as string) ?? "");
  const [insuranceId, setInsuranceId] = useState((ex.insurance_id as string) ?? "");

  /* ─── Draft autosave / recovery ───────────────────────────────────── */
  const draftValue = {
    firstName, middleName, lastName, dob, gender, cityOfBirth,
    email, phone, emergencyName, emergencyPhone, street, houseNo, postcode, city,
    programId, schoolId, startMonth, arrivalDate, courseStart, courseEnd,
    accommodationId, insuranceId,
  };
  const { restoredDraft, savedAt, expiresAt, expired, clearDraft, acknowledgeRestore, acknowledgeExpired } = useFormDraft({
    key: `profile-completion:${caseId}`,
    version: 1,
    value: draftValue,
  });

  useEffect(() => {
    if (!restoredDraft) return;
    const d = restoredDraft as typeof draftValue;
    setFirstName(d.firstName ?? ""); setMiddleName(d.middleName ?? ""); setLastName(d.lastName ?? "");
    setDob(d.dob ?? ""); setGender(d.gender ?? ""); setCityOfBirth(d.cityOfBirth ?? "");
    setEmail(d.email ?? ""); setPhone(d.phone ?? "");
    setEmergencyName(d.emergencyName ?? ""); setEmergencyPhone(d.emergencyPhone ?? "");
    setStreet(d.street ?? ""); setHouseNo(d.houseNo ?? ""); setPostcode(d.postcode ?? ""); setCity(d.city ?? "");
    setProgramId(d.programId ?? ""); setSchoolId(d.schoolId ?? ""); setStartMonth(d.startMonth ?? "");
    setArrivalDate(d.arrivalDate ?? ""); setCourseStart(d.courseStart ?? ""); setCourseEnd(d.courseEnd ?? "");
    setAccommodationId(d.accommodationId ?? ""); setInsuranceId(d.insuranceId ?? "");
    acknowledgeRestore();
    toast({ title: t("common.draft.restoredTitle"), description: t("common.draft.restoredBody") });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoredDraft]);

  // When the hook found an already-expired draft on mount, show the expiry
  // notice once (no fields are restored — the hook already discarded it).
  useEffect(() => {
    if (!expired) return;
    toast({ title: t("common.draft.expired"), description: t("common.draft.expiredBody") });
    acknowledgeExpired();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired]);

  const age = ageFromISO(dob);

  const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ");
  const selectedProgram = programs.find((p) => p.id === programId);
  const filteredAccoms = accommodations.filter((a) => !schoolId || a.school_id === schoolId);
  const selectedAccom = accommodations.find((a) => a.id === accommodationId);
  const selectedIns = insurances.find((i) => i.id === insuranceId);

  useEffect(() => {
    if (selectedProgram?.duration_in_months && courseStart) {
      // courseStart is ISO string; add months and format back to ISO
      const startDate = new Date(courseStart);
      if (!isNaN(startDate.getTime())) {
        const endDate = addMonths(startDate, selectedProgram.duration_in_months);
        setCourseEnd(format(endDate, "yyyy-MM-dd"));
      }
    }
  }, [selectedProgram?.duration_in_months, courseStart]);

  useEffect(() => {
    if (selectedProgram?.fixed_start_day_of_month && startMonth) {
      const [y, m] = startMonth.split("-").map(Number);
      const d = String(selectedProgram.fixed_start_day_of_month).padStart(2, "0");
      setCourseStart(`${y}-${String(m).padStart(2, "0")}-${d}`);
    }
  }, [selectedProgram?.fixed_start_day_of_month, startMonth]);

  useEffect(() => {
    setAccommodationId("");
  }, [schoolId]);

  useEffect(() => {
    (async () => {
      const results = (await Promise.all([
        db
          .from("programs")
          .select("id,name_en,name_ar,type,duration_in_months,fixed_start_day_of_month,lessons_per_week,price,currency")
          .eq("is_active", true)
          .order("name_en"),
        db.from("schools").select("id,name_en,name_ar,city").eq("is_active", true).order("name_en"),
        db.from("accommodations").select("id,name_en,name_ar,price,currency,school_id").eq("is_active", true),
        db.from("insurances").select("id,name,tier,price,currency").eq("is_active", true).order("tier"),
      ])) as any[];
      setPrograms(results[0].data ?? []);
      setSchools(results[1].data ?? []);
      setAccommodations(results[2].data ?? []);
      setInsurances(results[3].data ?? []);
    })();
  }, []);

  /* ── Email availability (debounced) ─────────────────────────────────── */
  // Skip when editing an existing case whose email is the student's own — only
  // flag emails that belong to a *different* account.
  const ownEmail = (ex.student_email ?? ex.email ?? "").toString().trim().toLowerCase();
  useEffect(() => {
    const value = email.trim();
    if (!value || !value.includes("@")) {
      setEmailTaken(false);
      setCheckingEmail(false);
      return;
    }
    if (value.toLowerCase() === ownEmail) {
      setEmailTaken(false);
      setCheckingEmail(false);
      return;
    }
    setCheckingEmail(true);
    const seq = ++emailCheckSeq.current;
    const timer = window.setTimeout(async () => {
      try {
        const res = await checkEmailAvailability(value);
        if (seq !== emailCheckSeq.current) return;
        setEmailTaken(!res.available);
      } catch {
        if (seq !== emailCheckSeq.current) return;
        // Permissive on error: don't block entry on a transient failure.
        setEmailTaken(false);
      } finally {
        if (seq === emailCheckSeq.current) setCheckingEmail(false);
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [email, ownEmail]);

  /* ── Validation ─────────────────────────────────────────────────────── */
  const validate = (s: StepKey): Record<string, string> => {
    const e: Record<string, string> = {};
    if (s === "personal") {
      if (!firstName.trim()) e.firstName = t("case.profileForm.errFirstName");
      if (!lastName.trim()) e.lastName = t("case.profileForm.errLastName");
    }
    if (s === "contact") {
      if (!email.trim() || !email.includes("@")) e.email = t("case.profileForm.errEmail");
      else if (emailTaken) e.email = t("case.profileForm.errEmailTaken");
      else if (checkingEmail) e.email = t("case.profileForm.errEmail");
      if (!phone.trim()) e.phone = t("case.profileForm.errPhone");
    }
    return e;
  };

  const goTo = (target: StepKey) => {
    const idx = STEP_KEYS.indexOf(target);
    const currentIdx = STEP_KEYS.indexOf(step);
    if (idx > currentIdx) {
      const errs = validate(step);
      if (Object.keys(errs).length > 0) {
        setErrors(errs);
        toast({ variant: "destructive", description: t("case.profileForm.errStep") });
        return;
      }
      setErrors({});
    } else {
      setErrors({});
    }
    setStep(target);
  };

  const goNext = () => {
    const idx = STEP_KEYS.indexOf(step);
    if (idx < STEP_KEYS.length - 1) goTo(STEP_KEYS[idx + 1]);
  };
  const goBack = () => {
    const idx = STEP_KEYS.indexOf(step);
    if (idx > 0) {
      setErrors({});
      setStep(STEP_KEYS[idx - 1]);
    }
  };

  /* ── Save ───────────────────────────────────────────────────────────── */
  const handleSave = async () => {
    const allErrs = { ...validate("personal"), ...validate("contact") };
    if (Object.keys(allErrs).length > 0) {
      setErrors(allErrs);
      toast({ variant: "destructive", description: t("case.profileForm.errMissing") });
      return;
    }
    setSaving(true);
    try {
      const extraData = {
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        student_email: email,
        student_phone: phone,
        emergency_contact_name: emergencyName,
        emergency_contact_phone: emergencyPhone,
        city_of_birth: cityOfBirth,
        street,
        house_no: houseNo,
        postcode,
        city,
        date_of_birth: dob || null,
        age,
        gender,
        program_id: programId || null,
        school_id: schoolId || null,
        accommodation_id: accommodationId || null,
        insurance_id: insuranceId || null,
        arrival_date: arrivalDate || null,
        course_start: courseStart || null,
        course_end: courseEnd || null,
        start_month: startMonth || null,
      };
      const upsertPayload: any = {
        case_id: caseId,
        program_id: programId || null,
        accommodation_id: accommodationId || null,
        program_start_date: courseStart || null,
        program_end_date: courseEnd || null,
        service_fee: 0,
        program_price: selectedProgram?.price ?? 0,
        accommodation_price: selectedAccom?.price ?? 0,
        insurance_price: selectedIns?.price ?? 0,
        extra_data: extraData,
      };
      if (insuranceId) upsertPayload.insurance_id = insuranceId;

      const { error } = await db.from("case_submissions").upsert(upsertPayload, { onConflict: "case_id" });
      if (error) throw error;

      // .select() is required: without it a write blocked by row-level security
      // matches zero rows and returns no error, so the save fails silently.
      const { data: updatedCase, error: caseErr } = await db
        .from("cases")
        .update({
          full_name: fullName || undefined,
          phone_number: phone || undefined,
          status: "profile_completion",
        })
        .eq("id", caseId)
        .select("id")
        .maybeSingle();
      if (caseErr) throw caseErr;
      if (!updatedCase) throw new Error(t("case.profileForm.saveFailed"));

      await supabase.rpc("log_activity" as any, {
        p_actor_id: actorId,
        p_actor_name: actorName,
        p_action: "profile_filled",
        p_entity_type: "case",
        p_entity_id: caseId,
        p_metadata: { full_name: fullName },
      });

      clearDraft();
      toast({ title: t("case.profileForm.saved") });
      onSuccess();
    } catch (err: any) {
      toast({ variant: "destructive", description: err?.message || t("case.profileForm.saveFailed") });
    } finally {
      setSaving(false);
    }
  };

  /** Clears the saved draft and resets every form field to empty. */
  const handleClearDraft = () => {
    clearDraft();
    setFirstName(""); setMiddleName(""); setLastName("");
    setDob(""); setGender(""); setCityOfBirth("");
    setEmail(""); setPhone("");
    setEmergencyName(""); setEmergencyPhone("");
    setStreet(""); setHouseNo(""); setPostcode(""); setCity("");
    setProgramId(""); setSchoolId(""); setStartMonth("");
    setArrivalDate(""); setCourseStart(""); setCourseEnd("");
    setAccommodationId(""); setInsuranceId("");
    setErrors({});
  };

  /* ── Derived ────────────────────────────────────────────────────────── */
  const monthOptions = Array.from({ length: 24 }, (_, i) => {
    const d = addMonths(new Date(), i);
    return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy") };
  });

  const stepIdx = STEP_KEYS.indexOf(step);
  const isLastStep = stepIdx === STEP_KEYS.length - 1;
  const isFirstStep = stepIdx === 0;

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-5">
      {/* Step indicator */}
      <div className="flex items-center gap-1">
        {STEP_KEYS.map((sKey, i) => {
          const done = i < stepIdx;
          const current = sKey === step;
          return (
            <React.Fragment key={sKey}>
              <button
                onClick={() => goTo(sKey)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                  current
                    ? "bg-primary text-primary-foreground"
                    : done
                      ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                      : "bg-muted text-muted-foreground hover:bg-muted/80",
                )}
              >
                {done ? <Check className="h-3 w-3" /> : <span className="w-3 text-center">{i + 1}</span>}
                <span className="hidden sm:inline">{t(`case.profileForm.steps.${sKey}`)}</span>
              </button>
              {i < STEP_KEYS.length - 1 && <div className={cn("flex-1 h-px", done ? "bg-emerald-300" : "bg-border")} />}
            </React.Fragment>
          );
        })}
      </div>

      {/* ══ STEP 1: Personal Info ══ */}
      {step === "personal" && (
        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            {t("case.profileForm.headings.personal")}
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <FieldWrap label={t("case.profileForm.firstName")} error={errors.firstName}>
              <Input
                className={cn("mt-1", errors.firstName && "border-destructive")}
                name="darb-first-name"
                autoComplete="off"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </FieldWrap>
            <div>
              <Label>{t("case.profileForm.middleName")}</Label>
              <Input
                className="mt-1"
                name="darb-middle-name"
                autoComplete="off"
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
              />
            </div>
            <FieldWrap label={t("case.profileForm.lastName")} error={errors.lastName}>
              <Input
                className={cn("mt-1", errors.lastName && "border-destructive")}
                name="darb-last-name"
                autoComplete="off"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </FieldWrap>
          </div>
          <BirthdayPicker label={t("case.profileForm.dob")} value={dob} onChange={setDob} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("case.profileForm.gender")}</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={t("case.profileForm.ph.select")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">{t("case.profileForm.genderOpts.male")}</SelectItem>
                  <SelectItem value="female">{t("case.profileForm.genderOpts.female")}</SelectItem>
                  <SelectItem value="other">{t("case.profileForm.genderOpts.other")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("case.profileForm.cityOfBirth")}</Label>
              <Input
                className="mt-1"
                name="darb-city-of-birth"
                autoComplete="off"
                value={cityOfBirth}
                onChange={(e) => setCityOfBirth(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {/* ══ STEP 2: Contact Details ══ */}
      {step === "contact" && (
        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            {t("case.profileForm.headings.contact")}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <FieldWrap label={t("case.profileForm.email")} error={errors.email}>
              <Input
                className={cn("mt-1", errors.email && "border-destructive")}
                type="email"
                name="darb-student-email"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("case.profileForm.ph.email")}
              />
            </FieldWrap>
            <FieldWrap label={t("case.profileForm.phone")} error={errors.phone}>
              <Input
                className={cn("mt-1", errors.phone && "border-destructive")}
                name="darb-student-phone"
                autoComplete="off"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t("case.profileForm.ph.phone")}
              />
            </FieldWrap>
          </div>
          {/*
            Emergency contact fields carry deliberately non-standard `name`
            values. Chrome ignores autoComplete="off" on fields it recognises by
            name or by proximity, and was filling these from the saved email.
          */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("case.profileForm.emergencyName")}</Label>
              <Input
                className="mt-1"
                name="darb-emergency-name"
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore="true"
                value={emergencyName}
                onChange={(e) => setEmergencyName(e.target.value)}
              />
            </div>
            <div>
              <Label>{t("case.profileForm.emergencyPhone")}</Label>
              <Input
                className="mt-1"
                name="darb-emergency-phone"
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore="true"
                value={emergencyPhone}
                onChange={(e) => setEmergencyPhone(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>{t("case.profileForm.address")}</Label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              <Input
                name="darb-street"
                autoComplete="off"
                placeholder={t("case.profileForm.street")}
                value={street}
                onChange={(e) => setStreet(e.target.value)}
              />
              <Input
                name="darb-house-no"
                autoComplete="off"
                placeholder={t("case.profileForm.houseNo")}
                value={houseNo}
                onChange={(e) => setHouseNo(e.target.value)}
              />
              <Input
                name="darb-postcode"
                autoComplete="off"
                placeholder={t("case.profileForm.postcode")}
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
              />
            </div>
            <Input
              className="mt-2"
              name="darb-city"
              autoComplete="off"
              placeholder={t("case.profileForm.city")}
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* ══ STEP 3: Program ══ */}
      {step === "program" && (
        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            {t("case.profileForm.headings.program")}
          </h3>
          <div>
            <Label>{t("case.profileForm.languageProgram")}</Label>
            <Select value={programId} onValueChange={setProgramId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={t("case.profileForm.ph.program")} />
              </SelectTrigger>
              <SelectContent>
                {programs.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {nameOf(p)}
                    {p.lessons_per_week ? ` · ${t("case.profileForm.lessonsPerWeek", { count: p.lessons_per_week })}` : ""}
                    {p.duration_in_months ? ` · ${t("case.profileForm.monthsShort", { count: p.duration_in_months })}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedProgram && (
              <div className="mt-2 p-2 rounded-lg bg-primary/5 border border-primary/20 text-xs text-muted-foreground flex flex-wrap gap-3">
                {selectedProgram.lessons_per_week && (
                  <span>📚 {t("case.profileForm.lessonsPerWeek", { count: selectedProgram.lessons_per_week })}</span>
                )}
                {selectedProgram.duration_in_months && (
                  <span>⏱ {t("case.profileForm.monthsLong", { count: selectedProgram.duration_in_months })}</span>
                )}
                {selectedProgram.price && (
                  <span>
                    💰 {selectedProgram.price.toLocaleString("en-US")} {selectedProgram.currency}
                  </span>
                )}
                {selectedProgram.fixed_start_day_of_month && (
                  <span>📅 {t("case.profileForm.startsDay", { day: selectedProgram.fixed_start_day_of_month })}</span>
                )}
              </div>
            )}
          </div>
          <div>
            <Label>{t("case.profileForm.intakeMonth")}</Label>
            <Select value={startMonth} onValueChange={setStartMonth}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={t("case.profileForm.ph.intake")} />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <DateField label={t("case.profileForm.courseStart")} value={courseStart} onChange={setCourseStart} />
            <div>
              <Label>{t("case.profileForm.courseEnd")}</Label>
              <div
                className={cn(
                  "mt-1 flex items-center h-10 px-3 rounded-md border text-sm bg-muted/30",
                  courseEnd ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {courseEnd || t("case.profileForm.ph.autoCalculated")}
              </div>
              {selectedProgram?.duration_in_months && courseEnd && (
                <p className="text-xs text-emerald-600 mt-1">
                  ✓ {t("case.profileForm.autoFrom", { count: selectedProgram.duration_in_months })}
                </p>
              )}
            </div>
          </div>
          <div>
            <Label>{t("case.profileForm.school")}</Label>
            <Select value={schoolId} onValueChange={setSchoolId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={t("case.profileForm.ph.school")} />
              </SelectTrigger>
              <SelectContent>
                {schools.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {nameOf(s)}
                    {s.city ? ` — ${s.city}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DateField label={t("case.profileForm.arrivalDate")} value={arrivalDate} onChange={setArrivalDate} />
        </div>
      )}

      {/* ══ STEP 4: Accommodation ══ */}
      {step === "accommodation" && (
        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            {t("case.profileForm.headings.accommodation")}
          </h3>
          <div>
            <Label>
              {t("case.profileForm.accommodation")}{" "}
              {!schoolId && (
                <span className="text-muted-foreground text-xs">{t("case.profileForm.accommodationHint")}</span>
              )}
            </Label>
            <Select
              value={accommodationId || "__none__"}
              onValueChange={(v) => setAccommodationId(v === "__none__" ? "" : v)}
              disabled={filteredAccoms.length === 0}
            >
              <SelectTrigger className="mt-1">
                <SelectValue
                  placeholder={
                    filteredAccoms.length === 0
                      ? schoolId
                        ? t("case.profileForm.ph.noAccommodations")
                        : t("case.profileForm.ph.schoolFirst")
                      : t("case.profileForm.ph.accommodation")
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("case.profileForm.ph.none")}</SelectItem>
                {filteredAccoms.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {nameOf(a)}
                    {a.price ? ` — ${a.price.toLocaleString("en-US")} ${a.currency}${t("case.profileForm.perMonth")}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedAccom?.price && (
              <p className="text-xs text-emerald-600 mt-1">
                💰 {selectedAccom.price.toLocaleString("en-US")} {selectedAccom.currency}
                {t("case.profileForm.perMonth")}
              </p>
            )}
          </div>
          <div>
            <Label>{t("case.profileForm.insurance")}</Label>
            <Select value={insuranceId || "__none__"} onValueChange={(v) => setInsuranceId(v === "__none__" ? "" : v)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={t("case.profileForm.ph.none")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("case.profileForm.ph.none")}</SelectItem>
                {insurances.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name} ({i.tier}) — {i.price.toLocaleString("en-US")} {i.currency}
                    {t("case.profileForm.perMonth")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(selectedProgram?.price || selectedAccom?.price || selectedIns?.price) && (
            <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm space-y-1.5">
              <p className="font-semibold text-foreground mb-2">{t("case.profileForm.costSummary")}</p>
              {selectedProgram?.price && (
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("case.profileForm.costProgram")}</span>
                  <span className="font-medium text-foreground">
                    {selectedProgram.price.toLocaleString("en-US")} {selectedProgram.currency}
                  </span>
                </div>
              )}
              {selectedAccom?.price && selectedProgram?.duration_in_months && (
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("case.profileForm.costAccommodation", { count: selectedProgram.duration_in_months })}</span>
                  <span className="font-medium text-foreground">
                    {(selectedAccom.price * selectedProgram.duration_in_months).toLocaleString("en-US")}{" "}
                    {selectedAccom.currency}
                  </span>
                </div>
              )}
              {selectedIns?.price && selectedProgram?.duration_in_months && (
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("case.profileForm.costInsurance", { count: selectedProgram.duration_in_months })}</span>
                  <span className="font-medium text-foreground">
                    {(selectedIns.price * selectedProgram.duration_in_months).toLocaleString("en-US")}{" "}
                    {selectedIns.currency}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══ STEP 5: Review ══ */}
      {step === "review" && (
        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            {t("case.profileForm.headings.review")}
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {(
              [
                [t("case.profileForm.fullName"), fullName || "—"],
                [t("case.profileForm.dob"), dob || "—"],
                [t("case.profileForm.gender"), gender ? t(`case.profileForm.genderOpts.${gender}`, gender) : "—"],
                [t("case.profileForm.cityOfBirth"), cityOfBirth || "—"],
                [t("case.profileForm.email"), email || "—"],
                [t("case.profileForm.phone"), phone || "—"],
                [t("case.profileForm.emergency"), emergencyName ? `${emergencyName} · ${emergencyPhone}` : "—"],
                [t("case.profileForm.address"), [street, houseNo, postcode, city].filter(Boolean).join(", ") || "—"],
                [t("case.profileForm.languageProgram"), nameOf(selectedProgram) || "—"],
                [t("case.profileForm.school"), nameOf(schools.find((s) => s.id === schoolId)) || "—"],
                [t("case.profileForm.courseStart"), courseStart || "—"],
                [t("case.profileForm.courseEnd"), courseEnd || "—"],
                [t("case.profileForm.arrivalDate"), arrivalDate || "—"],
                [t("case.profileForm.accommodation"), nameOf(selectedAccom) || "—"],
                [t("case.profileForm.insurance"), selectedIns?.name || "—"],
              ] as [string, string][]
            ).map(([k, v]) => (
              <div key={k} className="flex flex-col gap-0.5 p-2 rounded-lg bg-muted/30">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{k}</span>
                <span className="text-sm font-medium truncate">{v}</span>
              </div>
            ))}
          </div>
          {(Object.keys(validate("personal")).length > 0 || Object.keys(validate("contact")).length > 0) && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              ⚠ {t("case.profileForm.reviewMissing")}
            </div>
          )}
        </div>
      )}

      {/* Draft status + expiry countdown */}
      {(savedAt !== null || expired) && (
        <DraftStatus
          savedAt={savedAt}
          expiresAt={expiresAt}
          expired={expired}
          onClear={handleClearDraft}
        />
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-2 border-t border-border">
        <Button variant="outline" onClick={goBack} disabled={isFirstStep}>
          <ChevronLeft className="h-4 w-4 me-1" /> {t("case.profileForm.back")}
        </Button>
        {isLastStep ? (
          <Button onClick={handleSave} disabled={saving || checkingEmail}>
            {(saving || checkingEmail) && <Loader2 className="h-4 w-4 animate-spin me-1" />}
            {t("case.profileForm.save")}
          </Button>
        ) : (
          <Button onClick={goNext} disabled={checkingEmail}>
            {checkingEmail ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : null}
            {t("case.profileForm.next")} <ChevronRight className="h-4 w-4 ms-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
