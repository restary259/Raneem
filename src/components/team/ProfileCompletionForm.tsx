import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format, differenceInYears, addMonths } from "date-fns";
import { CalendarIcon, Loader2, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

// Bypass Supabase generated types for new tables/columns
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db: any = supabase as unknown as any;

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

const STEPS = [
  { key: "personal", label: "Personal Info" },
  { key: "contact", label: "Contact Details" },
  { key: "program", label: "Program" },
  { key: "accommodation", label: "Accommodation" },
  { key: "review", label: "Review & Save" },
] as const;
type StepKey = (typeof STEPS)[number]["key"];

export default function ProfileCompletionForm({
  caseId,
  actorId,
  actorName,
  existingData,
  caseData: cd,
  onSuccess,
}: Props) {
  const { toast } = useToast();
  const { i18n } = useTranslation("dashboard");
  const isAr = i18n.language === "ar";

  const [programs, setPrograms] = useState<Program[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [insurances, setInsurances] = useState<Insurance[]>([]);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<StepKey>("personal");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const ex = existingData ?? {};
  // Normalise: SubmitNewStudent saves "email"/"phone", ProfileCompletion uses "student_email"/"student_phone"
  const readEmail = (ex.student_email ?? ex.email ?? "") as string;
  const readPhone = (ex.student_phone ?? ex.phone ?? "") as string;

  // ── Personal Info ──
  const [firstName, setFirstName] = useState((ex.first_name as string) ?? "");
  const [middleName, setMiddleName] = useState((ex.middle_name as string) ?? "");
  const [lastName, setLastName] = useState((ex.last_name as string) ?? "");
  const [dob, setDob] = useState<Date | undefined>(ex.date_of_birth ? new Date(ex.date_of_birth as string) : undefined);
  const [gender, setGender] = useState((ex.gender as string) ?? "");
  const [cityOfBirth, setCityOfBirth] = useState((ex.city_of_birth as string) ?? "");

  // ── Contact ──
  const [email, setEmail] = useState(readEmail);
  const [phone, setPhone] = useState(readPhone);
  const [emergencyName, setEmergencyName] = useState((ex.emergency_contact_name as string) ?? "");
  const [emergencyPhone, setEmergencyPhone] = useState((ex.emergency_contact_phone as string) ?? "");
  const [street, setStreet] = useState((ex.street as string) ?? "");
  const [houseNo, setHouseNo] = useState((ex.house_no as string) ?? "");
  const [postcode, setPostcode] = useState((ex.postcode as string) ?? "");
  const [city, setCity] = useState((ex.city as string) ?? cd?.city ?? "");

  // ── Program ──
  const [programId, setProgramId] = useState((ex.program_id as string) ?? "");
  const [schoolId, setSchoolId] = useState((ex.school_id as string) ?? "");
  const [startMonth, setStartMonth] = useState((ex.start_month as string) ?? "");
  const [arrivalDate, setArrivalDate] = useState<Date | undefined>(
    ex.arrival_date ? new Date(ex.arrival_date as string) : undefined,
  );
  const [courseStart, setCourseStart] = useState<Date | undefined>(
    ex.course_start ? new Date(ex.course_start as string) : undefined,
  );
  const [courseEnd, setCourseEnd] = useState<Date | undefined>(
    ex.course_end ? new Date(ex.course_end as string) : undefined,
  );

  // ── Accommodation ──
  const [accommodationId, setAccommodationId] = useState((ex.accommodation_id as string) ?? "");
  const [insuranceId, setInsuranceId] = useState((ex.insurance_id as string) ?? "");

  const age = dob ? differenceInYears(new Date(), dob) : null;
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ");
  const selectedProgram = programs.find((p) => p.id === programId);
  const filteredAccoms = accommodations.filter((a) => !schoolId || a.school_id === schoolId);
  const selectedAccom = accommodations.find((a) => a.id === accommodationId);
  const selectedIns = insurances.find((i) => i.id === insuranceId);

  // Auto end-date from program duration
  useEffect(() => {
    if (selectedProgram?.duration_in_months && courseStart) {
      setCourseEnd(addMonths(courseStart, selectedProgram.duration_in_months));
    }
  }, [selectedProgram?.duration_in_months, courseStart]);

  // Auto start from fixed start day + intake month
  useEffect(() => {
    if (selectedProgram?.fixed_start_day_of_month && startMonth) {
      const [y, m] = startMonth.split("-").map(Number);
      setCourseStart(new Date(y, m - 1, selectedProgram.fixed_start_day_of_month));
    }
  }, [selectedProgram?.fixed_start_day_of_month, startMonth]);

  // Reset accommodation when school changes
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

  // ── Validation per step ──────────────────────────────────────────────
  const validate = (s: StepKey): Record<string, string> => {
    const e: Record<string, string> = {};
    if (s === "personal") {
      if (!firstName.trim()) e.firstName = "First name is required";
      if (!lastName.trim()) e.lastName = "Last name is required";
    }
    if (s === "contact") {
      if (!email.trim() || !email.includes("@")) e.email = "Valid email is required";
      if (!phone.trim()) e.phone = "Phone number is required";
    }
    return e;
  };

  const goTo = (target: StepKey) => {
    const idx = STEPS.findIndex((s) => s.key === target);
    const currentIdx = STEPS.findIndex((s) => s.key === step);
    if (idx > currentIdx) {
      // Validate current step before advancing
      const errs = validate(step);
      if (Object.keys(errs).length > 0) {
        setErrors(errs);
        toast({ variant: "destructive", description: "Please fill in the required fields before continuing." });
        return;
      }
      setErrors({});
    } else {
      setErrors({});
    }
    setStep(target);
  };

  const goNext = () => {
    const idx = STEPS.findIndex((s) => s.key === step);
    if (idx < STEPS.length - 1) goTo(STEPS[idx + 1].key);
  };

  const goBack = () => {
    const idx = STEPS.findIndex((s) => s.key === step);
    if (idx > 0) {
      setErrors({});
      setStep(STEPS[idx - 1].key);
    }
  };

  // ── Save ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    // Final validation of required steps
    const personalErrs = validate("personal");
    const contactErrs = validate("contact");
    const allErrs = { ...personalErrs, ...contactErrs };
    if (Object.keys(allErrs).length > 0) {
      setErrors(allErrs);
      toast({
        variant: "destructive",
        description: "Some required fields are missing. Please go back and fill them in.",
      });
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
        date_of_birth: dob ? format(dob, "yyyy-MM-dd") : null,
        age,
        gender,
        program_id: programId || null,
        school_id: schoolId || null,
        accommodation_id: accommodationId || null,
        insurance_id: insuranceId || null,
        arrival_date: arrivalDate ? format(arrivalDate, "yyyy-MM-dd") : null,
        course_start: courseStart ? format(courseStart, "yyyy-MM-dd") : null,
        course_end: courseEnd ? format(courseEnd, "yyyy-MM-dd") : null,
        start_month: startMonth || null,
      };

      const upsertPayload: any = {
        case_id: caseId,
        program_id: programId || null,
        accommodation_id: accommodationId || null,
        program_start_date: courseStart ? format(courseStart, "yyyy-MM-dd") : null,
        program_end_date: courseEnd ? format(courseEnd, "yyyy-MM-dd") : null,
        service_fee: 0,
        program_price: selectedProgram?.price ?? 0,
        accommodation_price: selectedAccom?.price ?? 0,
        insurance_price: selectedIns?.price ?? 0,
        extra_data: extraData,
      };
      if (insuranceId) upsertPayload.insurance_id = insuranceId;

      const { error } = await db.from("case_submissions").upsert(upsertPayload, { onConflict: "case_id" });
      if (error) throw error;

      await db
        .from("cases")
        .update({
          full_name: fullName || undefined,
          phone_number: phone || undefined,
          status: "profile_completion",
        })
        .eq("id", caseId);

      await supabase.rpc("log_activity" as any, {
        p_actor_id: actorId,
        p_actor_name: actorName,
        p_action: "profile_filled",
        p_entity_type: "case",
        p_entity_id: caseId,
        p_metadata: { full_name: fullName },
      });

      toast({ title: "Profile saved successfully" });
      onSuccess();
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  // ── Sub-components ────────────────────────────────────────────────────
  const BirthdayPicker = ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: Date | undefined;
    onChange: (d: Date | undefined) => void;
  }) => {
    const years = Array.from({ length: 2015 - 1940 + 1 }, (_, i) => 1940 + i).reverse();
    const months = [
      { v: "01", l: "January" },
      { v: "02", l: "February" },
      { v: "03", l: "March" },
      { v: "04", l: "April" },
      { v: "05", l: "May" },
      { v: "06", l: "June" },
      { v: "07", l: "July" },
      { v: "08", l: "August" },
      { v: "09", l: "September" },
      { v: "10", l: "October" },
      { v: "11", l: "November" },
      { v: "12", l: "December" },
    ];
    const selYear = value ? value.getFullYear().toString() : "";
    const selMonth = value ? String(value.getMonth() + 1).padStart(2, "0") : "";
    const selDay = value ? String(value.getDate()).padStart(2, "0") : "";
    const daysInMonth = selYear && selMonth ? new Date(parseInt(selYear), parseInt(selMonth), 0).getDate() : 31;
    const days = Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, "0"));
    const update = (y: string, m: string, d: string) => {
      if (y && m && d) onChange(new Date(`${y}-${m}-${d}`));
    };
    return (
      <div>
        <Label>{label}</Label>
        <div className="grid grid-cols-3 gap-2 mt-1">
          <Select value={selYear} onValueChange={(v) => update(v, selMonth, selDay || "01")}>
            <SelectTrigger>
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent className="max-h-48">
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selMonth} onValueChange={(v) => update(selYear, v, selDay || "01")}>
            <SelectTrigger>
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m.v} value={m.v}>
                  {m.l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selDay} onValueChange={(v) => update(selYear, selMonth, v)}>
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
        {value && (
          <p className="text-xs text-muted-foreground mt-1">Age: {differenceInYears(new Date(), value)} years</p>
        )}
      </div>
    );
  };

  const DatePick = ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: Date | undefined;
    onChange: (d: Date | undefined) => void;
  }) => (
    <div>
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn("w-full justify-start text-left font-normal mt-1", !value && "text-muted-foreground")}
          >
            <CalendarIcon className="me-2 h-4 w-4" />
            {value ? format(value, "PP") : "Pick date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={onChange}
            initialFocus
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );

  const Field = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
    <div>
      <Label className={error ? "text-destructive" : ""}>
        {label}
        {error ? " *" : ""}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );

  const monthOptions = Array.from({ length: 24 }, (_, i) => {
    const d = addMonths(new Date(), i);
    return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy") };
  });

  const stepIdx = STEPS.findIndex((s) => s.key === step);
  const isLastStep = stepIdx === STEPS.length - 1;
  const isFirstStep = stepIdx === 0;

  return (
    <div className="space-y-5">
      {/* ── Step indicator ── */}
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => {
          const done = i < stepIdx;
          const current = s.key === step;
          return (
            <React.Fragment key={s.key}>
              <button
                onClick={() => goTo(s.key)}
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
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && <div className={cn("flex-1 h-px", done ? "bg-emerald-300" : "bg-border")} />}
            </React.Fragment>
          );
        })}
      </div>

      {/* ══ STEP 1: Personal Info ══ */}
      {step === "personal" && (
        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Personal Information</h3>
          <div className="grid grid-cols-3 gap-3">
            <Field label="First Name" error={errors.firstName}>
              <Input
                className={cn("mt-1", errors.firstName && "border-destructive")}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </Field>
            <div>
              <Label>Middle Name</Label>
              <Input className="mt-1" value={middleName} onChange={(e) => setMiddleName(e.target.value)} />
            </div>
            <Field label="Last Name" error={errors.lastName}>
              <Input
                className={cn("mt-1", errors.lastName && "border-destructive")}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </Field>
          </div>
          <BirthdayPicker label="Date of Birth" value={dob} onChange={setDob} />
          <div className="grid grid-cols-2 gap-3">
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
        </div>
      )}

      {/* ══ STEP 2: Contact Details ══ */}
      {step === "contact" && (
        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Contact Details</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email" error={errors.email}>
              <Input
                className={cn("mt-1", errors.email && "border-destructive")}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="student@email.com"
              />
            </Field>
            <Field label="Phone" error={errors.phone}>
              <Input
                className={cn("mt-1", errors.phone && "border-destructive")}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+972..."
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Emergency Contact Name</Label>
              <Input className="mt-1" value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} />
            </div>
            <div>
              <Label>Emergency Contact Phone</Label>
              <Input className="mt-1" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} />
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
        </div>
      )}

      {/* ══ STEP 3: Program ══ */}
      {step === "program" && (
        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Program</h3>
          <div>
            <Label>Language Program</Label>
            <Select value={programId} onValueChange={setProgramId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select program" />
              </SelectTrigger>
              <SelectContent>
                {programs.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name_en}
                    {p.lessons_per_week ? ` · ${p.lessons_per_week} lessons/wk` : ""}
                    {p.duration_in_months ? ` · ${p.duration_in_months}mo` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedProgram && (
              <div className="mt-2 p-2 rounded-lg bg-primary/5 border border-primary/20 text-xs text-muted-foreground flex flex-wrap gap-3">
                {selectedProgram.lessons_per_week && <span>📚 {selectedProgram.lessons_per_week} lessons/week</span>}
                {selectedProgram.duration_in_months && <span>⏱ {selectedProgram.duration_in_months} months</span>}
                {selectedProgram.price && (
                  <span>
                    💰 {selectedProgram.price.toLocaleString()} {selectedProgram.currency}
                  </span>
                )}
                {selectedProgram.fixed_start_day_of_month && (
                  <span>📅 Starts day {selectedProgram.fixed_start_day_of_month}</span>
                )}
              </div>
            )}
          </div>
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
          <div className="grid grid-cols-2 gap-3">
            <DatePick label="Course Start Date" value={courseStart} onChange={setCourseStart} />
            <div>
              <Label>Course End Date</Label>
              <div
                className={cn(
                  "mt-1 flex items-center h-10 px-3 rounded-md border text-sm bg-muted/30",
                  courseEnd ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {courseEnd ? format(courseEnd, "PP") : "Auto-calculated"}
              </div>
              {selectedProgram?.duration_in_months && courseEnd && (
                <p className="text-xs text-emerald-600 mt-1">
                  ✓ Auto from {selectedProgram.duration_in_months}mo duration
                </p>
              )}
            </div>
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
          <DatePick label="Arrival Date in Germany" value={arrivalDate} onChange={setArrivalDate} />
        </div>
      )}

      {/* ══ STEP 4: Accommodation ══ */}
      {step === "accommodation" && (
        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Accommodation & Insurance
          </h3>
          <div>
            <Label>
              Accommodation{" "}
              {!schoolId && <span className="text-muted-foreground text-xs">(select a school first)</span>}
            </Label>
            <Select value={accommodationId} onValueChange={setAccommodationId} disabled={filteredAccoms.length === 0}>
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
                <SelectItem value="">None</SelectItem>
                {filteredAccoms.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name_en}
                    {a.price ? ` — ${a.price.toLocaleString()} ${a.currency}/mo` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedAccom?.price && (
              <p className="text-xs text-emerald-600 mt-1">
                💰 {selectedAccom.price.toLocaleString()} {selectedAccom.currency}/month
              </p>
            )}
          </div>
          <div>
            <Label>Insurance (optional)</Label>
            <Select value={insuranceId} onValueChange={setInsuranceId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {insurances.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name} ({i.tier}) — {i.price.toLocaleString()} {i.currency}/mo
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(selectedProgram?.price || selectedAccom?.price || selectedIns?.price) && (
            <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm space-y-1.5">
              <p className="font-semibold text-foreground mb-2">Cost Summary</p>
              {selectedProgram?.price && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Program</span>
                  <span className="font-medium text-foreground">
                    {selectedProgram.price.toLocaleString()} {selectedProgram.currency}
                  </span>
                </div>
              )}
              {selectedAccom?.price && selectedProgram?.duration_in_months && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Accommodation ({selectedProgram.duration_in_months}mo)</span>
                  <span className="font-medium text-foreground">
                    {(selectedAccom.price * selectedProgram.duration_in_months).toLocaleString()}{" "}
                    {selectedAccom.currency}
                  </span>
                </div>
              )}
              {selectedIns?.price && selectedProgram?.duration_in_months && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Insurance ({selectedProgram.duration_in_months}mo)</span>
                  <span className="font-medium text-foreground">
                    {(selectedIns.price * selectedProgram.duration_in_months).toLocaleString()} {selectedIns.currency}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══ STEP 5: Review & Save ══ */}
      {step === "review" && (
        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Review & Save</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ["Full Name", fullName || "—"],
              ["Date of Birth", dob ? format(dob, "PP") : "—"],
              ["Gender", gender || "—"],
              ["City of Birth", cityOfBirth || "—"],
              ["Email", email || "—"],
              ["Phone", phone || "—"],
              ["Emergency Contact", emergencyName ? `${emergencyName} · ${emergencyPhone}` : "—"],
              ["Address", [street, houseNo, postcode, city].filter(Boolean).join(", ") || "—"],
              ["Program", selectedProgram?.name_en || "—"],
              ["School", schools.find((s) => s.id === schoolId)?.name_en || "—"],
              ["Course Start", courseStart ? format(courseStart, "PP") : "—"],
              ["Course End", courseEnd ? format(courseEnd, "PP") : "—"],
              ["Arrival Date", arrivalDate ? format(arrivalDate, "PP") : "—"],
              ["Accommodation", selectedAccom?.name_en || "—"],
              ["Insurance", selectedIns?.name || "—"],
            ].map(([k, v]) => (
              <div key={k} className="flex flex-col gap-0.5 p-2 rounded-lg bg-muted/30">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{k}</span>
                <span className="text-sm font-medium truncate">{v}</span>
              </div>
            ))}
          </div>
          {Object.keys(validate("personal")).length > 0 || Object.keys(validate("contact")).length > 0 ? (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              ⚠ Some required fields are missing. Please go back and complete them.
            </div>
          ) : null}
        </div>
      )}

      {/* ── Navigation ── */}
      <div className="flex justify-between pt-2 border-t border-border">
        <Button variant="outline" onClick={goBack} disabled={isFirstStep}>
          <ChevronLeft className="h-4 w-4 me-1" /> Back
        </Button>
        {isLastStep ? (
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin me-1" />}
            Save Profile
          </Button>
        ) : (
          <Button onClick={goNext}>
            Next <ChevronRight className="h-4 w-4 ms-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
