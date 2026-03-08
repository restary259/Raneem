import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { addMonths, format, differenceInYears } from "date-fns";
import { ArrowLeft, Loader2, Upload, X, Check, ChevronRight, ChevronLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
// ✅ FIX: Use the shared intakeMonths utility (fixes hardcoded 2025 start)
import { generateIntakeMonths } from "@/utils/intakeMonths";
// ✅ FIX: Use normalizeDate to validate/store DOB (fixes broken Popover calendar)
import { DOB_MONTHS, DOB_YEARS, normalizeDate, daysInMonth } from "@/utils/dateUtils";

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

const FORM_STEPS = [
  { n: 1 as const, label: "Student Info" },
  { n: 2 as const, label: "Contact Details" },
  { n: 3 as const, label: "Program & Accommodation" },
  { n: 4 as const, label: "Payment & Documents" },
];
type StepNum = 1 | 2 | 3 | 4;

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
 * ✅ FIX: Replaced the broken Popover/Calendar date-picker with three
 *   manual Select dropdowns (Year / Month / Day).  The old Calendar
 *   component had a `pointer-events` issue in the project's CSS that
 *   prevented clicks from registering reliably on mobile and within
 *   modals.  This implementation is simpler, more accessible, and fully
 *   controllable.
 *
 * Internally stores the date as "YYYY-MM-DD" via normalizeDate().
 */
const BirthdayPicker = ({
  value,
  onChange,
}: {
  value: string; // ISO "YYYY-MM-DD" or ""
  onChange: (iso: string) => void;
}) => {
  // Derive year/month/day from the controlled ISO string
  const [year, setYear] = useState(() => (value ? value.split("-")[0] : ""));
  const [month, setMonth] = useState(() => (value ? value.split("-")[1] : ""));
  const [day, setDay] = useState(() => (value ? value.split("-")[2] : ""));

  // Recompute days when year/month change
  const numDays = daysInMonth(parseInt(month), parseInt(year));
  const days = Array.from({ length: numDays }, (_, i) => String(i + 1).padStart(2, "0"));

  // Clamp day if it exceeds new month length (e.g. Jan 31 → Feb)
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
      <Label>Date of Birth</Label>
      <div className="grid grid-cols-3 gap-2 mt-1">
        {/* Year */}
        <Select
          value={year}
          onValueChange={(v) => {
            setYear(v);
            tryUpdate(v, month, safeDay);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent className="max-h-48">
            {DOB_YEARS.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Month */}
        <Select
          value={month}
          onValueChange={(v) => {
            setMonth(v);
            tryUpdate(year, v, safeDay);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent>
            {DOB_MONTHS.map((m) => (
              <SelectItem key={m.v} value={m.v}>
                {m.l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Day */}
        <Select
          value={safeDay}
          onValueChange={(v) => {
            setDay(v);
            tryUpdate(year, month, v);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Day" />
          </SelectTrigger>
          <SelectContent className="max-h-48">
            {days.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {age !== null && !isNaN(age) && <p className="text-xs text-muted-foreground mt-1">Age: {age} years</p>}
    </div>
  );
};

/**
 * SimpleDateField
 * ──────────────────────────────────────────────────────────────────────
 * ✅ FIX: Replaced broken Popover/Calendar usage for arrival date and
 *   course start date with a plain <input type="date">.  This avoids
 *   the pointer-events bug entirely and renders natively on all devices.
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

const StepBar = ({ step }: { step: StepNum }) => (
  <div className="flex items-center gap-1 mb-6">
    {FORM_STEPS.map((s, i) => {
      const done = s.n < step;
      const current = s.n === step;
      return (
        <React.Fragment key={s.n}>
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
            {done ? <Check className="h-3 w-3" /> : <span className="w-3 text-center">{s.n}</span>}
            <span className="hidden sm:inline">{s.label}</span>
          </div>
          {i < FORM_STEPS.length - 1 && <div className={cn("flex-1 h-px", done ? "bg-emerald-300" : "bg-border")} />}
        </React.Fragment>
      );
    })}
  </div>
);

/* ══════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════ */
export default function SubmitNewStudentPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { i18n } = useTranslation("dashboard");
  const isAr = i18n.language === "ar";

  const [step, setStep] = useState<StepNum>(1);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Step 1 — Student Info
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  // ✅ FIX: dob stored as ISO string (not Date object) to match normalizeDate output
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [cityOfBirth, setCityOfBirth] = useState("");

  // Step 2 — Contact
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  // ✅ FIX: emergencyPhone was previously bound to the wrong state variable (email state).
  //         It now has its own isolated state.
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [street, setStreet] = useState("");
  const [houseNo, setHouseNo] = useState("");
  const [postcode, setPostcode] = useState("");
  const [city, setCity] = useState("");

  // Step 3 — Program & Accommodation
  const [programId, setProgramId] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [startMonth, setStartMonth] = useState("");
  // ✅ FIX: Replaced Date | undefined with ISO string for SimpleDateField
  const [arrivalDate, setArrivalDate] = useState("");
  const [courseStart, setCourseStart] = useState("");
  const [courseEnd, setCourseEnd] = useState("");
  const [accommodationId, setAccommodationId] = useState("");

  // Step 4 — Payment & Documents
  const [serviceFee, setServiceFee] = useState("");
  const [translationFee, setTranslationFee] = useState("0");
  const [paymentReceived, setPaymentReceived] = useState(false);
  const [skipDocuments, setSkipDocuments] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; file: File; category: string }[]>([]);

  const selectedProgram = programs.find((p) => p.id === programId);
  const filteredAccoms = accommodations.filter((a) => !schoolId || a.school_id === schoolId);
  const selectedAccom = accommodations.find((a) => a.id === accommodationId);
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ");
  const total = (parseFloat(serviceFee) || 0) + (parseFloat(translationFee) || 0);

  // ✅ FIX: Generate intake months from current month using utility
  const monthOptions = generateIntakeMonths(24);

  // Auto end-date from program duration
  useEffect(() => {
    if (selectedProgram?.duration_in_months && courseStart) {
      const end = addMonths(new Date(courseStart), selectedProgram.duration_in_months);
      setCourseEnd(format(end, "yyyy-MM-dd"));
    }
  }, [selectedProgram?.duration_in_months, courseStart]);

  // Auto course start from program fixed start day
  useEffect(() => {
    if (selectedProgram?.fixed_start_day_of_month && startMonth) {
      const [y, m] = startMonth.split("-").map(Number);
      const d = selectedProgram.fixed_start_day_of_month;
      setCourseStart(`${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
  }, [selectedProgram?.fixed_start_day_of_month, startMonth]);

  // Reset accommodation when school changes
  useEffect(() => {
    setAccommodationId("");
  }, [schoolId]);

  // Load programs / schools / accommodations
  useEffect(() => {
    Promise.all([
      (supabase as any)
        .from("programs")
        .select("id,name_en,name_ar,duration_in_months,fixed_start_day_of_month,lessons_per_week,price,currency")
        .eq("is_active", true)
        .order("name_en"),
      (supabase as any).from("schools").select("id,name_en,name_ar,city").eq("is_active", true).order("name_en"),
      (supabase as any)
        .from("accommodations")
        .select("id,name_en,name_ar,price,currency,school_id")
        .eq("is_active", true),
    ]).then(([{ data: p }, { data: sc }, { data: a }]) => {
      setPrograms(p ?? []);
      setSchools(sc ?? []);
      setAccommodations(a ?? []);
    });
  }, []);

  /* ── Validation ─────────────────────────────────────────────────────── */
  const validate = (s: StepNum): Record<string, string> => {
    const e: Record<string, string> = {};
    if (s === 1) {
      if (!firstName.trim()) e.firstName = "First name is required";
      if (!lastName.trim()) e.lastName = "Last name is required";
    }
    if (s === 2) {
      if (!email.trim() || !email.includes("@")) e.email = "Valid email is required";
      if (!phone.trim()) e.phone = "Phone number is required";
    }
    if (s === 4) {
      if (!serviceFee || parseFloat(serviceFee) <= 0) e.serviceFee = "Service fee is required";
      if (!paymentReceived) e.payment = "You must confirm payment was received";
    }
    return e;
  };

  const goNext = () => {
    const errs = validate(step);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      toast({
        variant: "destructive",
        description: "Please fill in the required fields.",
      });
      return;
    }
    setErrors({});
    setStep((s) => Math.min(s + 1, 4) as StepNum);
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
    const errs = validate(4);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const age = dob ? differenceInYears(new Date(), new Date(dob)) : null;

      const { data: newCase, error: caseErr } = await supabase
        .from("cases")
        .insert({
          full_name: fullName,
          phone_number: phone.trim(),
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
        program_id: programId || null,
        accommodation_id: accommodationId || null,
        program_start_date: courseStart || null,
        program_end_date: courseEnd || null,
        service_fee: parseFloat(serviceFee),
        translation_fee: 0,
        program_price: selectedProgram?.price ?? 0,
        accommodation_price: selectedAccom?.price ?? 0,
        payment_confirmed: true,
        payment_confirmed_at: now,
        payment_confirmed_by: user!.id,
        submitted_at: now,
        submitted_by: user!.id,
        extra_data: {
          first_name: firstName,
          middle_name: middleName,
          last_name: lastName,
          date_of_birth: dob || null,
          age,
          gender,
          city_of_birth: cityOfBirth,
          student_email: email.trim(),
          student_phone: phone.trim(),
          emergency_contact_name: emergencyName,
          // ✅ FIX: emergencyPhone now correctly refers to its own state variable
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
          documents_skipped: skipDocuments,
        },
      });

      for (const doc of uploadedFiles) {
        const path = `${caseId}/${doc.category}_${doc.file.name}`;
        const { data: uploadData } = await supabase.storage
          .from("student-documents")
          .upload(path, doc.file, { upsert: true });
        if (uploadData?.path) {
          const { data: urlData } = supabase.storage.from("student-documents").getPublicUrl(uploadData.path);
          await supabase.from("documents").insert({
            student_id: user!.id,
            case_id: caseId,
            file_name: doc.file.name,
            file_url: urlData?.publicUrl || "",
            file_type: doc.file.type,
            file_size: doc.file.size,
            category: doc.category,
            uploaded_by: user!.id,
          });
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      await supabase.functions.invoke("create-student-from-case", {
        body: {
          case_id: caseId,
          student_email: email.trim(),
          student_full_name: fullName,
          student_phone: phone.trim(),
        },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      await supabase.rpc("log_activity" as any, {
        p_actor_id: user!.id,
        p_actor_name: "Team Member",
        p_action: "student_submitted_direct",
        p_entity_type: "case",
        p_entity_id: caseId,
        p_metadata: { full_name: fullName, email },
      });

      toast({ title: "Student submitted & enrolled" });
      navigate(`/team/cases/${caseId}`);
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/team/cases")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">{isAr ? "تسجيل طالب جديد" : "Submit New Student"}</h1>
      </div>

      <StepBar step={step} />

      {/* ══ STEP 1: Student Info ══ */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Student Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <FieldWrap label="First Name *" error={errors.firstName}>
                <Input
                  className={cn("mt-1", errors.firstName && "border-destructive")}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </FieldWrap>
              <div>
                <Label>Middle Name</Label>
                <Input className="mt-1" value={middleName} onChange={(e) => setMiddleName(e.target.value)} />
              </div>
              <FieldWrap label="Last Name *" error={errors.lastName}>
                <Input
                  className={cn("mt-1", errors.lastName && "border-destructive")}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </FieldWrap>
            </div>

            {/* ✅ FIX: BirthdayPicker now uses three Select dropdowns instead of broken Popover/Calendar */}
            <BirthdayPicker value={dob} onChange={setDob} />

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Gender</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>City of Birth</Label>
                <Input className="mt-1" value={cityOfBirth} onChange={(e) => setCityOfBirth(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={goNext}>
                Next <ChevronRight className="h-4 w-4 ms-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ══ STEP 2: Contact Details ══ */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contact Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <FieldWrap label="Email *" error={errors.email}>
                <Input
                  className={cn("mt-1", errors.email && "border-destructive")}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@email.com"
                />
              </FieldWrap>
              <FieldWrap label="Phone *" error={errors.phone}>
                <Input
                  className={cn("mt-1", errors.phone && "border-destructive")}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+972..."
                />
              </FieldWrap>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Emergency Contact Name</Label>
                <Input className="mt-1" value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} />
              </div>
              <div>
                <Label>Emergency Contact Phone</Label>
                {/* ✅ FIX: This input now updates emergencyPhone state (was incorrectly bound to email state) */}
                <Input
                  className="mt-1"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  placeholder="+972..."
                />
              </div>
            </div>
            <div>
              <Label>Address</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <Input placeholder="Street" value={street} onChange={(e) => setStreet(e.target.value)} />
                <Input placeholder="House No." value={houseNo} onChange={(e) => setHouseNo(e.target.value)} />
                <Input placeholder="Postcode" value={postcode} onChange={(e) => setPostcode(e.target.value)} />
              </div>
              <Input className="mt-2" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={goBack}>
                <ChevronLeft className="h-4 w-4 me-1" /> Back
              </Button>
              <Button onClick={goNext}>
                Next <ChevronRight className="h-4 w-4 ms-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ══ STEP 3: Program & Accommodation ══ */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Program &amp; Accommodation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Program</Label>
                <Select value={programId} onValueChange={setProgramId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select program" />
                  </SelectTrigger>
                  <SelectContent>
                    {programs.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {isAr ? (p as any).name_ar : p.name_en}
                        {p.lessons_per_week ? ` · ${p.lessons_per_week} lessons/wk` : ""}
                        {p.duration_in_months ? ` · ${p.duration_in_months}mo` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedProgram && (
                  <div className="mt-2 p-2 rounded-lg bg-primary/5 border border-primary/20 text-xs text-muted-foreground flex flex-wrap gap-2">
                    {selectedProgram.lessons_per_week && <span>📚 {selectedProgram.lessons_per_week} lessons/wk</span>}
                    {selectedProgram.duration_in_months && <span>⏱ {selectedProgram.duration_in_months}mo</span>}
                    {selectedProgram.price && (
                      <span>
                        💰 {selectedProgram.price.toLocaleString()} {selectedProgram.currency}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div>
                <Label>School</Label>
                <Select value={schoolId} onValueChange={setSchoolId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select school" />
                  </SelectTrigger>
                  <SelectContent>
                    {schools.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name_en}
                        {s.city ? ` — ${s.city}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ✅ FIX: Intake months start from current month (generateIntakeMonths) */}
            <div>
              <Label>Intake Month</Label>
              <Select value={startMonth} onValueChange={setStartMonth}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select intake month" />
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

            <div className="grid md:grid-cols-3 gap-4">
              {/* ✅ FIX: Replaced broken Popover/Calendar with <input type="date"> */}
              <SimpleDateField label="Arrival Date" value={arrivalDate} onChange={setArrivalDate} />
              <SimpleDateField label="Course Start" value={courseStart} onChange={setCourseStart} />
              <div>
                <Label>Course End</Label>
                <div
                  className={cn(
                    "mt-1 flex items-center h-10 px-3 rounded-md border text-sm bg-muted/30",
                    courseEnd ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {courseEnd ? format(new Date(courseEnd), "PP") : "Auto-calculated"}
                </div>
              </div>
            </div>

            <div>
              <Label>
                Accommodation{" "}
                {!schoolId && <span className="text-muted-foreground text-xs">(select a school first)</span>}
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
                          ? "No accommodations for this school"
                          : "Select a school first"
                        : "Select accommodation"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {filteredAccoms.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {isAr ? a.name_ar : a.name_en}
                      {a.price ? ` — ${a.price.toLocaleString()} ${a.currency}/mo` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={goBack}>
                <ChevronLeft className="h-4 w-4 me-1" /> Back
              </Button>
              <Button onClick={goNext}>
                Next <ChevronRight className="h-4 w-4 ms-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ══ STEP 4: Payment & Documents ══ */}
      {step === 4 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <FieldWrap label="Service Fee (ILS) *" error={errors.serviceFee}>
                  <Input
                    className={cn("mt-1", errors.serviceFee && "border-destructive")}
                    type="number"
                    min="0"
                    value={serviceFee}
                    onChange={(e) => setServiceFee(e.target.value)}
                  />
                </FieldWrap>
                <div>
                  <Label>Translation Fee (ILS)</Label>
                  <Input
                    className="mt-1"
                    type="number"
                    min="0"
                    value={translationFee}
                    onChange={(e) => setTranslationFee(e.target.value)}
                  />
                </div>
              </div>
              {total > 0 && (
                <div className="flex justify-between p-3 rounded-lg bg-muted text-sm font-medium">
                  <span>Total</span>
                  <span>{total.toLocaleString()} ILS</span>
                </div>
              )}
              <div
                className={cn(
                  "flex items-start gap-3 p-3 border rounded-lg",
                  errors.payment && "border-destructive bg-destructive/5",
                )}
              >
                <Checkbox
                  id="pr"
                  checked={paymentReceived}
                  onCheckedChange={(v) => {
                    setPaymentReceived(v === true);
                    setErrors((e) => ({ ...e, payment: "" }));
                  }}
                />
                <Label htmlFor="pr" className="cursor-pointer text-sm">
                  I confirm full payment of {total.toLocaleString()} ILS has been received.
                </Label>
              </div>
              {errors.payment && <p className="text-xs text-destructive">{errors.payment}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Upload documents now or skip — the student can upload later via their dashboard.
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  { category: "passport", label: "Passport" },
                  { category: "biometric_photo", label: "Biometric Photo" },
                  { category: "translation", label: "Translations" },
                  { category: "other", label: "Other Documents" },
                ].map((doc) => {
                  const existing = uploadedFiles
                    .map((f, i) => ({ ...f, idx: i }))
                    .filter((f) => f.category === doc.category);
                  return (
                    <div key={doc.category} className="border border-dashed border-border rounded-lg p-3">
                      <Label className="text-xs text-muted-foreground block mb-2">{doc.label}</Label>
                      {existing.map((f) => (
                        <div key={f.idx} className="flex items-center gap-2 text-xs mb-1">
                          <Check className="h-3 w-3 text-green-500 shrink-0" />
                          <span className="truncate flex-1">{f.name}</span>
                          <button
                            onClick={() => removeFile(f.idx)}
                            className="text-muted-foreground hover:text-destructive shrink-0"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                      <label className="flex items-center gap-1 text-xs text-primary cursor-pointer hover:underline">
                        <Upload className="h-3 w-3" /> Add file
                        <input type="file" className="hidden" onChange={(e) => handleFileAdd(e, doc.category)} />
                      </label>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 p-3 border rounded-lg">
                <Checkbox id="skip" checked={skipDocuments} onCheckedChange={(v) => setSkipDocuments(v === true)} />
                <Label htmlFor="skip" className="text-sm cursor-pointer">
                  Skip — student will upload documents later
                </Label>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={goBack}>
              <ChevronLeft className="h-4 w-4 me-1" /> Back
            </Button>
            <Button onClick={handleSubmit} disabled={saving} size="lg">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 me-2 animate-spin" /> Submitting…
                </>
              ) : (
                "Submit & Create Student Account"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
