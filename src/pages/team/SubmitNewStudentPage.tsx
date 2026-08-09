import React, { useEffect, useMemo, useState } from "react";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { readFunctionError } from "@/lib/functionError";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { format, differenceInYears } from "date-fns";
import { ArrowLeft, Loader2, Upload, X, Check, ChevronRight, ChevronLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
// ✅ FIX: Use the shared intakeMonths utility (fixes hardcoded 2025 start)
import { generateIntakeMonths } from "@/utils/intakeMonths";
// ✅ FIX: Use normalizeDate to validate/store DOB (fixes broken Popover calendar)
import { DOB_MONTHS, DOB_YEARS, normalizeDate, daysInMonth } from "@/utils/dateUtils";
import { validateUploadFile } from "@/lib/uploadRules";
import { recordServiceFeePayment } from "@/services/CasePaymentService";
import { isLinkablePhone } from "@/lib/phone";
import { computeWeeklyCost, endDateForWeeks, formatMoney } from "@/lib/programPricing";
import { ageFromDob, computeInsuranceCost } from "@/lib/insurancePricing";
import { EDUCATION_LEVEL_VALUES, PASSPORT_TYPE_VALUES } from "@/lib/intakeOptions";

/* ─── Types ─────────────────────────────────────────────────────────── */
interface Program {
  id: string;
  name_en: string;
  name_ar: string;
  duration_in_months: number | null;
  fixed_start_day_of_month: number | null;
  lessons_per_week: number | null;
  price: number | null;
  currency: string;
  price_tiers: unknown;
  school_id: string | null;
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
  price_tiers: unknown;
}
interface Insurance {
  id: string;
  name: string;
  provider: string | null;
  price: number | null;
  currency: string;
  billing_period: string | null;
  age_price_tiers: unknown;
}

const STEP_KEYS = ['stepStudentInfo', 'stepContactDetails', 'stepProgram', 'stepPayment', 'stepReview'] as const;
type StepNum = 1 | 2 | 3 | 4 | 5;
const LAST_STEP: StepNum = 5;

/* ══════════════════════════════════════════════════════════════════════
   MODULE-LEVEL COMPONENTS — defined outside render to keep React
   identity stable and prevent inputs from losing focus on re-render.
══════════════════════════════════════════════════════════════════════ */

const FieldWrap = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
  <div>
    <Label className={error ? "text-destructive" : ""}>{label}</Label>
    {children}
    {error && <p className="text-xs text-destructive mt-1">{error}</p>}
  </div>
);

/**
 * BirthdayPicker
 * ──────────────────────────────────────────────────────────────────────
 * Three manual Select dropdowns (Year / Month / Day) instead of a popover
 * calendar, which had a pointer-events problem inside modals and on mobile.
 * Internally stores the date as "YYYY-MM-DD" via normalizeDate().
 */
const BirthdayPicker = ({
  value,
  onChange,
  t,
}: {
  value: string;
  onChange: (iso: string) => void;
  t: TFunction;
}) => {
  const [year, setYear] = useState(() => (value ? value.split("-")[0] : ""));
  const [month, setMonth] = useState(() => (value ? value.split("-")[1] : ""));
  const [day, setDay] = useState(() => (value ? value.split("-")[2] : ""));

  const numDays = daysInMonth(parseInt(month), parseInt(year));
  const days = Array.from({ length: numDays }, (_, i) => String(i + 1).padStart(2, "0"));
  const safeDay = day && parseInt(day) > numDays ? String(numDays).padStart(2, "0") : day;

  const tryUpdate = (y: string, m: string, d: string) => {
    if (!y || !m || !d) return;
    try {
      const iso = normalizeDate(d, m, y);
      onChange(iso);
    } catch {
      // Don't propagate invalid intermediate states
    }
  };

  const age = year && month && safeDay ? differenceInYears(new Date(), new Date(`${year}-${month}-${safeDay}`)) : null;

  return (
    <div>
      <Label>{t('lawyer.submitStudent.dateOfBirth')}</Label>
      <div className="grid grid-cols-3 gap-2 mt-1">
        <Select value={year} onValueChange={(v) => { setYear(v); tryUpdate(v, month, safeDay); }}>
          <SelectTrigger><SelectValue placeholder={t('lawyer.submitStudent.year')} /></SelectTrigger>
          <SelectContent className="max-h-48">
            {DOB_YEARS.map((y) => (<SelectItem key={y} value={String(y)}>{y}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={month} onValueChange={(v) => { setMonth(v); tryUpdate(year, v, safeDay); }}>
          <SelectTrigger><SelectValue placeholder={t('lawyer.submitStudent.month')} /></SelectTrigger>
          <SelectContent>
            {DOB_MONTHS.map((m) => (<SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={safeDay} onValueChange={(v) => { setDay(v); tryUpdate(year, month, v); }}>
          <SelectTrigger><SelectValue placeholder={t('lawyer.submitStudent.day')} /></SelectTrigger>
          <SelectContent className="max-h-48">
            {days.map((d) => (<SelectItem key={d} value={d}>{d}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>
      {age !== null && !isNaN(age) && <p className="text-xs text-muted-foreground mt-1">{t('lawyer.submitStudent.ageYears', { age })}</p>}
    </div>
  );
};

/**
 * SimpleDateField — plain <input type="date">, renders natively everywhere.
 */
const SimpleDateField = ({
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
    <Input type="date" className="mt-1" value={value} onChange={(e) => onChange(e.target.value)} />
  </div>
);

const StepBar = ({ step, t }: { step: StepNum; t: TFunction }) => (
  <div className="flex items-center gap-1 mb-6">
    {STEP_KEYS.map((key, i) => {
      const n = (i + 1) as StepNum;
      const done = n < step;
      const current = n === step;
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
          </div>
          {i < STEP_KEYS.length - 1 && <div className={cn("flex-1 h-px", done ? "bg-emerald-300" : "bg-border")} />}
        </React.Fragment>
      );
    })}
  </div>
);

/** One line of the review screen. */
const ReviewRow = ({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) => (
  <div className={cn("flex items-start justify-between gap-4 py-1.5 text-sm", strong && "font-semibold")}>
    <span className="text-muted-foreground shrink-0">{label}</span>
    <span className="text-end break-words">{value}</span>
  </div>
);

/* ══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════ */
export default function SubmitNewStudentPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t, i18n } = useTranslation("dashboard");
  const isAr = i18n.language === "ar";
  const ss = (k: string) => t(`lawyer.submitStudent.${k}`);

  const [step, setStep] = useState<StepNum>(1);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [insurances, setInsurances] = useState<Insurance[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Step 1 — Student Info
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [cityOfBirth, setCityOfBirth] = useState("");
  // Intake fields that live on `cases` — the pipeline, Admin Submissions and
  // Student Management all read them from there, so they must be captured here.
  const [educationLevel, setEducationLevel] = useState("");
  const [passportType, setPassportType] = useState("");

  // Step 2 — Contact
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [street, setStreet] = useState("");
  const [houseNo, setHouseNo] = useState("");
  const [postcode, setPostcode] = useState("");
  const [city, setCity] = useState("");

  // Step 3 — Program & Accommodation
  const [schoolId, setSchoolId] = useState("");
  const [programId, setProgramId] = useState("");
  const [programWeeks, setProgramWeeks] = useState("");
  const [startMonth, setStartMonth] = useState("");
  const [arrivalDate, setArrivalDate] = useState("");
  const [courseStart, setCourseStart] = useState("");
  const [courseEnd, setCourseEnd] = useState("");
  const [accommodationId, setAccommodationId] = useState("");
  const [accommodationWeeks, setAccommodationWeeks] = useState("");
  const [insuranceId, setInsuranceId] = useState("");

  // Step 4 — Payment & Documents
  const [serviceFee, setServiceFee] = useState("");
  const [paymentReceived, setPaymentReceived] = useState(false);
  const [skipDocuments, setSkipDocuments] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; file: File; category: string }[]>([]);

  // Step 5 — Review
  const [reviewConfirmed, setReviewConfirmed] = useState(false);

  /* ─── Draft autosave / recovery (files are never persisted) ────────── */
  const draftValue = {
    step, firstName, middleName, lastName, dob, gender, cityOfBirth, educationLevel, passportType,
    email, phone, emergencyName, emergencyPhone, street, houseNo, postcode, city,
    programId, schoolId, startMonth, arrivalDate, courseStart, courseEnd,
    accommodationId, serviceFee, programWeeks, accommodationWeeks, insuranceId,
  };
  const { restoredDraft, clearDraft, acknowledgeRestore } = useFormDraft({
    key: 'submit-new-student',
    version: 2,
    value: draftValue,
  });

  useEffect(() => {
    if (!restoredDraft) return;
    const d = restoredDraft as typeof draftValue;
    setStep((d.step as StepNum) ?? 1);
    setFirstName(d.firstName ?? ""); setMiddleName(d.middleName ?? ""); setLastName(d.lastName ?? "");
    setDob(d.dob ?? ""); setGender(d.gender ?? ""); setCityOfBirth(d.cityOfBirth ?? "");
    setEducationLevel(d.educationLevel ?? ""); setPassportType(d.passportType ?? "");
    setEmail(d.email ?? ""); setPhone(d.phone ?? "");
    setEmergencyName(d.emergencyName ?? ""); setEmergencyPhone(d.emergencyPhone ?? "");
    setStreet(d.street ?? ""); setHouseNo(d.houseNo ?? ""); setPostcode(d.postcode ?? ""); setCity(d.city ?? "");
    setSchoolId(d.schoolId ?? ""); setProgramId(d.programId ?? ""); setStartMonth(d.startMonth ?? "");
    setArrivalDate(d.arrivalDate ?? ""); setCourseStart(d.courseStart ?? ""); setCourseEnd(d.courseEnd ?? "");
    setAccommodationId(d.accommodationId ?? ""); setServiceFee(d.serviceFee ?? "");
    setProgramWeeks(d.programWeeks ?? ""); setAccommodationWeeks(d.accommodationWeeks ?? "");
    setInsuranceId(d.insuranceId ?? "");
    acknowledgeRestore();
    toast({ title: t('common.draft.restoredTitle'), description: t('common.draft.restoredBody') });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoredDraft]);

  /* ─── Catalogue selections, always scoped to the chosen school ─────── */
  const selectedSchool = schools.find((s) => s.id === schoolId);
  const selectedProgram = programs.find((p) => p.id === programId);
  const selectedAccom = accommodations.find((a) => a.id === accommodationId);
  const selectedInsurance = insurances.find((i) => i.id === insuranceId);
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ");

  const nameOf = (r: { name_en?: string | null; name_ar?: string | null } | undefined | null) =>
    (isAr ? r?.name_ar || r?.name_en : r?.name_en || r?.name_ar) ?? "—";

  const programCost = useMemo(
    () => computeWeeklyCost(selectedProgram, parseInt(programWeeks) || 0),
    [selectedProgram, programWeeks],
  );
  const accomCost = useMemo(
    () => computeWeeklyCost(selectedAccom, parseInt(accommodationWeeks) || 0),
    [selectedAccom, accommodationWeeks],
  );
  const insuranceCost = useMemo(
    () => computeInsuranceCost(selectedInsurance ?? null, ageFromDob(dob), courseStart || null, courseEnd || null),
    [selectedInsurance, dob, courseStart, courseEnd],
  );
  const eurTotal = programCost.total + accomCost.total + (insuranceCost.total ?? 0);
  const feeTotal = parseFloat(serviceFee) || 0;

  const monthOptions = generateIntakeMonths(24);

  // Course end is derived from the number of weeks the student is enrolled for.
  useEffect(() => {
    const end = endDateForWeeks(courseStart, parseInt(programWeeks) || 0);
    if (end) setCourseEnd(end);
  }, [courseStart, programWeeks]);

  // Auto course start from the program's fixed monthly start day
  useEffect(() => {
    if (selectedProgram?.fixed_start_day_of_month && startMonth) {
      const [y, m] = startMonth.split("-").map(Number);
      const d = selectedProgram.fixed_start_day_of_month;
      setCourseStart(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
  }, [selectedProgram?.fixed_start_day_of_month, startMonth]);

  // Changing the school invalidates every school-bound selection, including the
  // durations and derived dates that belonged to the previous school's program.
  useEffect(() => {
    setProgramId("");
    setAccommodationId("");
    setProgramWeeks("");
    setAccommodationWeeks("");
    setStartMonth("");
    setCourseStart("");
    setCourseEnd("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);


  // Load the school list and the insurance catalogue once.
  useEffect(() => {
    Promise.all([
      (supabase as any).from("schools").select("id,name_en,name_ar,city").eq("is_active", true).order("name_en"),
      (supabase as any)
        .from("insurances")
        .select("id,name,provider,price,currency,billing_period,age_price_tiers")
        .eq("is_active", true)
        .order("name"),
    ]).then(([{ data: sc }, { data: ins }]) => {
      setSchools(sc ?? []);
      setInsurances(ins ?? []);
    });
  }, []);

  // Programs and accommodation are queried per school, so the option lists can
  // never contain another school's catalogue.
  useEffect(() => {
    if (!schoolId) {
      setPrograms([]);
      setAccommodations([]);
      return;
    }
    let cancelled = false;
    Promise.all([
      (supabase as any)
        .from("programs")
        .select("id,name_en,name_ar,duration_in_months,fixed_start_day_of_month,lessons_per_week,price,currency,price_tiers,school_id")
        .eq("is_active", true)
        .eq("school_id", schoolId)
        .order("name_en"),
      (supabase as any)
        .from("accommodations")
        .select("id,name_en,name_ar,price,currency,school_id,price_tiers")
        .eq("is_active", true)
        .eq("school_id", schoolId)
        .order("name_en"),
    ]).then(([{ data: p }, { data: a }]) => {
      if (cancelled) return;
      setPrograms(p ?? []);
      setAccommodations(a ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [schoolId]);

  /* ── Validation ─────────────────────────────────────────────────────── */
  const validate = (s: StepNum): Record<string, string> => {
    const e: Record<string, string> = {};
    if (s === 1) {
      if (!firstName.trim()) e.firstName = ss('errorFirstName');
      if (!lastName.trim()) e.lastName = ss('errorLastName');
    }
    if (s === 2) {
      if (!email.trim() || !email.includes("@")) e.email = ss('errorEmail');
      if (!phone.trim() || !isLinkablePhone(phone)) e.phone = ss('errorPhone');
    }
    if (s === 3) {
      if (!schoolId) e.school = ss('errorSchool');
      if (programId && (!programWeeks || parseInt(programWeeks) <= 0)) e.programWeeks = ss('errorWeeks');
      if (accommodationId && (!accommodationWeeks || parseInt(accommodationWeeks) <= 0)) e.accommodationWeeks = ss('errorWeeks');
    }
    if (s === 4) {
      if (!serviceFee || parseFloat(serviceFee) <= 0) e.serviceFee = ss('errorServiceFee');
      if (!paymentReceived) e.payment = ss('errorPayment');
    }
    return e;
  };

  const goNext = () => {
    const errs = validate(step);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast({
        variant: "destructive",
        description: ss('errorRequired'),
      });
      return;
    }
    setErrors({});
    setStep((s) => Math.min(s + 1, LAST_STEP) as StepNum);
  };
  const goBack = () => {
    setErrors({});
    setStep((s) => Math.max(s - 1, 1) as StepNum);
  };

  /* ── File handling ──────────────────────────────────────────────────── */
  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>, category: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFiles((prev) => [...prev, { name: file.name, file, category }]);
    e.target.value = "";
  };
  const removeFile = (idx: number) => setUploadedFiles((prev) => prev.filter((_, i) => i !== idx));

  /* ── Submit ─────────────────────────────────────────────────────────── */
  const handleSubmit = async () => {
    // The case can only be created from the review step, after an explicit
    // confirmation — never as a side effect of finishing a form field.
    if (step !== LAST_STEP || !reviewConfirmed || saving) return;
    const errs = { ...validate(3), ...validate(4) };
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast({ variant: "destructive", description: ss('errorRequired') });
      return;
    }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const age = dob ? differenceInYears(new Date(), new Date(dob)) : null;
      const cleanEmail = email.trim().toLowerCase();
      const cleanPhone = phone.trim();

      // ── Duplicate guard ───────────────────────────────────────────────
      // The same person must not silently receive a second case (and with it a
      // second activation email). Warn on a matching phone or email first.
      const { data: phoneMatch } = await supabase
        .from("cases")
        .select("id, case_reference, full_name")
        .eq("phone_number", cleanPhone)
        .limit(1);
      const { data: emailMatch } = await (supabase as any)
        .from("case_submissions")
        .select("case_id")
        .eq("student_email", cleanEmail)
        .limit(1);
      const dupCase = phoneMatch?.[0];
      if ((dupCase || emailMatch?.[0]) && !window.confirm(ss("duplicateWarning"))) {
        setSaving(false);
        if (dupCase) navigate(`/team/cases/${dupCase.id}`);
        return;
      }

      const { data: newCase, error: caseErr } = await supabase
        .from("cases")
        .insert({
          full_name: fullName,
          phone_number: cleanPhone,
          city: city || null,
          education_level: educationLevel || null,
          passport_type: passportType || null,
          source: "submit_new_student",
          status: "submitted",
          assigned_to: user!.id,
        })
        .select()
        .single();
      if (caseErr) throw caseErr;
      const caseId = (newCase as any).id;

      await (supabase as any).from("case_submissions").insert({
        case_id: caseId,
        school_id: schoolId || null,
        program_id: programId || null,
        accommodation_id: accommodationId || null,
        insurance_id: insuranceId || null,
        program_start_date: courseStart || null,
        program_end_date: courseEnd || null,
        service_fee: parseFloat(serviceFee),
        // Weekly rate × weeks — `*_price` columns always hold the TOTAL.
        program_weeks: programCost.weeks || null,
        program_weekly_price: programCost.weeklyRate,
        program_price: programCost.total,
        accommodation_weeks: accomCost.weeks || null,
        accommodation_weekly_price: accomCost.weeklyRate,
        accommodation_price: accomCost.total,
        insurance_price: insuranceCost.total ?? 0,
        payment_confirmed: true,
        payment_confirmed_at: now,
        payment_confirmed_by: user!.id,
        submitted_at: now,
        submitted_by: user!.id,
        // Real columns — the Admin Submissions view reads these, not extra_data.
        student_email: cleanEmail,
        student_phone: cleanPhone,
        extra_data: {
          first_name: firstName,
          middle_name: middleName,
          last_name: lastName,
          date_of_birth: dob || null,
          age,
          gender,
          city_of_birth: cityOfBirth,
          student_email: cleanEmail,
          student_phone: cleanPhone,
          emergency_contact_name: emergencyName,
          emergency_contact_phone: emergencyPhone,
          street,
          house_no: houseNo,
          postcode,
          city,
          address: [street, houseNo, postcode, city].filter(Boolean).join(", "),
          program_id: programId || null,
          school_id: schoolId || null,
          start_month: startMonth || null,
          arrival_date: arrivalDate || null,
          course_start: courseStart || null,
          course_end: courseEnd || null,
          accommodation_id: accommodationId || null,
          insurance_id: insuranceId || null,
          documents_skipped: skipDocuments,
        },
      });

      // The fee was collected here, so it must also land in the case finance
      // panel — it reads case_services/case_payments, not case_submissions.
      try {
        await recordServiceFeePayment({
          caseId,
          actorId: user!.id,
          amount: parseFloat(serviceFee),
          paidAt: now,
        });
      } catch (payErr) {
        console.error("[SubmitNewStudent] service fee payment", payErr);
      }



      // Create/link the student account FIRST so uploaded documents can be
      // owned by the student rather than by the uploading team member.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const { data: accountRes, error: accountErr } = await supabase.functions.invoke("create-student-from-case", {
        body: {
          case_id: caseId,
          student_email: cleanEmail,
          student_full_name: fullName,
          student_phone: cleanPhone,
        },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (accountErr) {
        // Never swallow the account-creation failure: the wizard would carry on
        // and attach documents to the wrong owner.
        const reason = await readFunctionError(accountErr);
        console.error("[SubmitNewStudent] create-student-from-case", reason);
        toast({ variant: "destructive", description: reason });
      }
      const studentUserId = (accountRes as any)?.user_id as string | undefined;

      for (const doc of uploadedFiles) {
        const invalid = validateUploadFile(doc.file);
        if (invalid) {
          toast({ variant: "destructive", description: `${doc.file.name}: ${invalid}` });
          continue;
        }
        // Path is keyed on the student so the student storage policy
        // (folder[1] = auth.uid()) lets them read their own files.
        const folder = studentUserId ?? caseId;
        const path = `${folder}/${caseId}_${doc.category}_${doc.file.name}`;
        const { data: uploadData } = await supabase.storage
          .from("student-documents")
          .upload(path, doc.file, { upsert: true });

        if (uploadData?.path) {
          await supabase.from("documents").insert({
            student_id: studentUserId ?? user!.id,
            case_id: caseId,
            file_name: doc.file.name,
            // Bucket is private: store the bare storage path and sign it on read.
            file_url: uploadData.path,
            file_type: doc.file.type,
            file_size: doc.file.size,
            category: doc.category,
            uploaded_by: user!.id,
          });
        }
      }


      await supabase.rpc("log_activity" as any, {
        p_actor_id: user!.id,
        p_actor_name: "Team Member",
        p_action: "student_submitted_direct",
        p_entity_type: "case",
        p_entity_id: caseId,
        p_metadata: { full_name: fullName, email },
      });

      clearDraft();
      toast({ title: ss('successTitle') });
      navigate(`/team/cases/${caseId}`);
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-2 min-w-0">
        <Button variant="ghost" size="sm" className="shrink-0" onClick={() => navigate("/team/cases")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl sm:text-2xl font-bold min-w-0 flex-1 truncate">{ss('title')}</h1>
      </div>

      <StepBar step={step} t={t} />

      {/* ══ STEP 1: Student Info ══ */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{ss('studentInfo')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <FieldWrap label={`${ss('firstName')} *`} error={errors.firstName}>
                <Input className={cn("mt-1", errors.firstName && "border-destructive")} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </FieldWrap>
              <div>
                <Label>{ss('middleName')}</Label>
                <Input className="mt-1" value={middleName} onChange={(e) => setMiddleName(e.target.value)} />
              </div>
              <FieldWrap label={`${ss('lastName')} *`} error={errors.lastName}>
                <Input className={cn("mt-1", errors.lastName && "border-destructive")} value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </FieldWrap>
            </div>

            <BirthdayPicker value={dob} onChange={setDob} t={t} />

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>{ss('gender')}</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={ss('genderSelect')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">{ss('genderMale')}</SelectItem>
                    <SelectItem value="female">{ss('genderFemale')}</SelectItem>
                    <SelectItem value="other">{ss('genderOther')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{ss('cityOfBirth')}</Label>
                <Input className="mt-1" value={cityOfBirth} onChange={(e) => setCityOfBirth(e.target.value)} />
              </div>
            </div>

            {/* Stored on the case itself so the pipeline and admin views are
                not left with blank intake fields. */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>{ss('educationLevel')}</Label>
                <Select value={educationLevel} onValueChange={setEducationLevel}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={ss('educationLevelSelect')} /></SelectTrigger>
                  <SelectContent>
                    {EDUCATION_LEVEL_VALUES.map((v) => (
                      <SelectItem key={v} value={v}>{t(`case.educationLevels.${v}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{ss('passportType')}</Label>
                <Select value={passportType} onValueChange={setPassportType}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder={ss('passportTypeSelect')} /></SelectTrigger>
                  <SelectContent>
                    {PASSPORT_TYPE_VALUES.map((v) => (
                      <SelectItem key={v} value={v}>{t(`case.passportTypes.${v}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={goNext}>{ss('next')} <ChevronRight className="h-4 w-4 ms-1" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ══ STEP 2: Contact Details ══ */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{ss('stepContactDetails')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <FieldWrap label={`${ss('email')} *`} error={errors.email}>
                <Input className={cn("mt-1", errors.email && "border-destructive")} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="student@email.com" />
              </FieldWrap>
              <FieldWrap label={`${ss('phone')} *`} error={errors.phone}>
                <Input className={cn("mt-1", errors.phone && "border-destructive")} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+972..." />
              </FieldWrap>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>{ss('emergencyName')}</Label>
                <Input className="mt-1" value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} />
              </div>
              <div>
                <Label>{ss('emergencyPhone')}</Label>
                <Input className="mt-1" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} placeholder="+972..." />
              </div>
            </div>
            <div>
              <Label>{ss('address')}</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
                <Input placeholder={ss('street')} value={street} onChange={(e) => setStreet(e.target.value)} />
                <Input placeholder={ss('houseNo')} value={houseNo} onChange={(e) => setHouseNo(e.target.value)} />
                <Input placeholder={ss('postcode')} value={postcode} onChange={(e) => setPostcode(e.target.value)} />
              </div>
              <Input className="mt-2" placeholder={ss('city')} value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={goBack}><ChevronLeft className="h-4 w-4 me-1" /> {ss('back')}</Button>
              <Button onClick={goNext}>{ss('next')} <ChevronRight className="h-4 w-4 ms-1" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ══ STEP 3: School → Program → Accommodation → Insurance ══ */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{ss('stepProgram')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FieldWrap label={`${ss('school')} *`} error={errors.school}>
              <Select value={schoolId} onValueChange={setSchoolId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder={ss('selectSchool')} /></SelectTrigger>
                <SelectContent>
                  {schools.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {nameOf(s)}{s.city ? ` — ${s.city}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldWrap>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>{ss('program')}</Label>
                <Select value={programId} onValueChange={setProgramId} disabled={!schoolId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={!schoolId ? ss('selectSchoolFirst') : programs.length === 0 ? ss('noProgramsForSchool') : ss('selectProgram')} />
                  </SelectTrigger>
                  <SelectContent>
                    {programs.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {nameOf(p)}
                        {p.lessons_per_week ? ` · ${p.lessons_per_week} ${ss('lessonsPerWeek')}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <FieldWrap label={ss('programWeeks')} error={errors.programWeeks}>
                <Input
                  className={cn("mt-1", errors.programWeeks && "border-destructive")}
                  type="number"
                  min="1"
                  max="104"
                  value={programWeeks}
                  onChange={(e) => setProgramWeeks(e.target.value)}
                  disabled={!programId}
                  placeholder="40"
                />
              </FieldWrap>
            </div>

            {selectedProgram && programCost.weeklyRate !== null && (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm space-y-1">
                <ReviewRow label={ss('weeklyPrice')} value={formatMoney(programCost.weeklyRate, programCost.currency)} />
                <ReviewRow label={ss('weeks')} value={programCost.weeks || "—"} />
                <ReviewRow label={ss('programTotal')} value={formatMoney(programCost.total, programCost.currency)} strong />
              </div>
            )}

            <div>
              <Label>{ss('intakeMonth')}</Label>
              <Select value={startMonth} onValueChange={setStartMonth}>
                <SelectTrigger className="mt-1"><SelectValue placeholder={ss('selectIntakeMonth')} /></SelectTrigger>
                <SelectContent>
                  {monthOptions.map((m) => (<SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <SimpleDateField label={ss('arrivalDate')} value={arrivalDate} onChange={setArrivalDate} />
              <SimpleDateField label={ss('courseStart')} value={courseStart} onChange={setCourseStart} />
              <div>
                <Label>{ss('courseEnd')}</Label>
                <div className={cn("mt-1 flex items-center h-10 px-3 rounded-md border text-sm bg-muted/30", courseEnd ? "text-foreground" : "text-muted-foreground")}>
                  {courseEnd ? format(new Date(courseEnd), "PP") : ss('autoCalc')}
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>
                  {ss('accommodation')}{" "}
                  {!schoolId && <span className="text-muted-foreground text-xs">({ss('selectSchoolFirst')})</span>}
                </Label>
                <Select
                  value={accommodationId || "__none__"}
                  onValueChange={(v) => setAccommodationId(v === "__none__" ? "" : v)}
                  disabled={!schoolId}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={accommodations.length === 0 ? (schoolId ? ss('noAccomForSchool') : ss('selectSchoolFirst')) : ss('selectAccom')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{ss('noAccom')}</SelectItem>
                    {accommodations.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{nameOf(a)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <FieldWrap label={ss('accommodationWeeks')} error={errors.accommodationWeeks}>
                <Input
                  className={cn("mt-1", errors.accommodationWeeks && "border-destructive")}
                  type="number"
                  min="1"
                  max="104"
                  value={accommodationWeeks}
                  onChange={(e) => setAccommodationWeeks(e.target.value)}
                  disabled={!accommodationId}
                  placeholder={programWeeks || "40"}
                />
              </FieldWrap>
            </div>

            {selectedAccom && accomCost.weeklyRate !== null && (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm space-y-1">
                <ReviewRow label={ss('weeklyPrice')} value={formatMoney(accomCost.weeklyRate, accomCost.currency)} />
                <ReviewRow label={ss('weeks')} value={accomCost.weeks || "—"} />
                <ReviewRow label={ss('accommodationTotal')} value={formatMoney(accomCost.total, accomCost.currency)} strong />
              </div>
            )}

            <div>
              <Label>{ss('insurance')}</Label>
              <Select value={insuranceId || "__none__"} onValueChange={(v) => setInsuranceId(v === "__none__" ? "" : v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder={ss('selectInsurance')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{ss('noInsurance')}</SelectItem>
                  {insurances.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name}{i.provider ? ` — ${i.provider}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedInsurance && insuranceCost.total !== null && (
                <p className="text-xs text-muted-foreground mt-1">
                  {formatMoney(insuranceCost.total, selectedInsurance.currency ?? "EUR")}
                  {insuranceCost.months ? ` · ${insuranceCost.months} × ${formatMoney(insuranceCost.monthly ?? 0, selectedInsurance.currency ?? "EUR")}` : ""}
                </p>
              )}
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={goBack}><ChevronLeft className="h-4 w-4 me-1" /> {ss('back')}</Button>
              <Button onClick={goNext}>{ss('next')} <ChevronRight className="h-4 w-4 ms-1" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ══ STEP 4: Payment & Documents ══ */}
      {step === 4 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{ss('payment')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FieldWrap label={`${ss('serviceFee')} *`} error={errors.serviceFee}>
                <Input className={cn("mt-1", errors.serviceFee && "border-destructive")} type="number" min="0" value={serviceFee} onChange={(e) => setServiceFee(e.target.value)} />
              </FieldWrap>
              {feeTotal > 0 && (
                <div className="flex justify-between p-3 rounded-lg bg-muted text-sm font-medium">
                  <span>{ss('total')}</span>
                  <span>{feeTotal.toLocaleString('en-US')} ILS</span>
                </div>
              )}
              <div className={cn("flex items-start gap-3 p-3 border rounded-lg", errors.payment && "border-destructive bg-destructive/5")}>
                <Checkbox id="pr" checked={paymentReceived} onCheckedChange={(v) => { setPaymentReceived(v === true); setErrors((e) => ({ ...e, payment: "" })); }} />
                <Label htmlFor="pr" className="cursor-pointer text-sm">
                  {t('lawyer.submitStudent.confirmPayment', { amount: feeTotal.toLocaleString('en-US') })}
                </Label>
              </div>
              {errors.payment && <p className="text-xs text-destructive">{errors.payment}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{ss('documents')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{ss('documentsHint')}</p>
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  { category: "passport", labelKey: "docPassport" },
                  { category: "biometric_photo", labelKey: "docBiometric" },
                  { category: "translation", labelKey: "docTranslation" },
                  { category: "other", labelKey: "docOther" },
                ].map((doc) => {
                  const existing = uploadedFiles.map((f, i) => ({ ...f, idx: i })).filter((f) => f.category === doc.category);
                  return (
                    <div key={doc.category} className="border border-dashed border-border rounded-lg p-3">
                      <Label className="text-xs text-muted-foreground block mb-2">{ss(doc.labelKey)}</Label>
                      {existing.map((f) => (
                        <div key={f.idx} className="flex items-center gap-2 text-xs mb-1">
                          <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                          <span className="truncate flex-1">{f.name}</span>
                          <button onClick={() => removeFile(f.idx)} className="text-muted-foreground hover:text-destructive shrink-0"><X className="h-3 w-3" /></button>
                        </div>
                      ))}
                      <label className="flex items-center gap-1 text-xs text-primary cursor-pointer hover:underline">
                        <Upload className="h-3 w-3" /> {ss('addFile')}
                        <input type="file" className="hidden" onChange={(e) => handleFileAdd(e, doc.category)} />
                      </label>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 p-3 border rounded-lg">
                <Checkbox id="skip" checked={skipDocuments} onCheckedChange={(v) => setSkipDocuments(v === true)} />
                <Label htmlFor="skip" className="text-sm cursor-pointer">{ss('skipDocuments')}</Label>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={goBack}><ChevronLeft className="h-4 w-4 me-1" /> {ss('back')}</Button>
            <Button onClick={goNext}>{ss('reviewCta')} <ChevronRight className="h-4 w-4 ms-1" /></Button>
          </div>
        </div>
      )}

      {/* ══ STEP 5: Review & confirm ══ */}
      {step === 5 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{ss('reviewTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{ss('reviewHint')}</p>

              <section className="rounded-lg border p-3">
                <h3 className="text-sm font-semibold mb-1">{ss('studentInfo')}</h3>
                <ReviewRow label={ss('firstName')} value={fullName || "—"} />
                <ReviewRow label={ss('email')} value={email || "—"} />
                <ReviewRow label={ss('phone')} value={phone || "—"} />
                <ReviewRow label={ss('dateOfBirth')} value={dob || "—"} />
                <ReviewRow label={ss('educationLevel')} value={educationLevel ? t(`case.educationLevels.${educationLevel}`) : "—"} />
                <ReviewRow label={ss('passportType')} value={passportType ? t(`case.passportTypes.${passportType}`) : "—"} />
              </section>

              <section className="rounded-lg border p-3">
                <h3 className="text-sm font-semibold mb-1">{ss('stepProgram')}</h3>
                <ReviewRow label={ss('school')} value={selectedSchool ? nameOf(selectedSchool) : "—"} />
                <ReviewRow label={ss('program')} value={selectedProgram ? nameOf(selectedProgram) : "—"} />
                <ReviewRow
                  label={ss('programWeeks')}
                  value={programCost.weeks ? `${programCost.weeks} × ${formatMoney(programCost.weeklyRate ?? 0, programCost.currency)}` : "—"}
                />
                <ReviewRow label={ss('courseStart')} value={courseStart || "—"} />
                <ReviewRow label={ss('courseEnd')} value={courseEnd || "—"} />
                <ReviewRow label={ss('accommodation')} value={selectedAccom ? nameOf(selectedAccom) : ss('noAccom')} />
                <ReviewRow
                  label={ss('accommodationWeeks')}
                  value={accomCost.weeks ? `${accomCost.weeks} × ${formatMoney(accomCost.weeklyRate ?? 0, accomCost.currency)}` : "—"}
                />
                <ReviewRow label={ss('insurance')} value={selectedInsurance ? selectedInsurance.name : ss('noInsurance')} />
              </section>

              <section className="rounded-lg border p-3">
                <h3 className="text-sm font-semibold mb-1">{ss('costSummary')}</h3>
                <ReviewRow label={ss('programTotal')} value={formatMoney(programCost.total, programCost.currency)} />
                <ReviewRow label={ss('accommodationTotal')} value={formatMoney(accomCost.total, accomCost.currency)} />
                <ReviewRow label={ss('insurance')} value={formatMoney(insuranceCost.total ?? 0, selectedInsurance?.currency ?? "EUR")} />
                <ReviewRow label={ss('schoolCostsTotal')} value={formatMoney(eurTotal, programCost.currency)} strong />
                <ReviewRow label={ss('serviceFee')} value={`${feeTotal.toLocaleString('en-US')} ILS`} strong />
              </section>

              <div className="flex items-start gap-3 p-3 border rounded-lg">
                <Checkbox id="reviewOk" checked={reviewConfirmed} onCheckedChange={(v) => setReviewConfirmed(v === true)} />
                <Label htmlFor="reviewOk" className="cursor-pointer text-sm">{ss('reviewConfirmLabel')}</Label>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2">
            <Button variant="outline" onClick={goBack} className="w-full sm:w-auto">
              <ChevronLeft className="h-4 w-4 me-1" /> {ss('back')}
            </Button>
            <Button onClick={handleSubmit} disabled={saving || !reviewConfirmed} size="lg" className="w-full sm:w-auto">
              {saving ? (<><Loader2 className="h-4 w-4 me-2 animate-spin" /> {ss('submitting')}</>) : ss('confirmSubmit')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
