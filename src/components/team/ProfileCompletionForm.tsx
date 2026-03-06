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

const STEPS = [
  { key: "personal", label: "Personal Info" },
  { key: "contact", label: "Contact Details" },
  { key: "program", label: "Program" },
  { key: "accommodation", label: "Accommodation" },
  { key: "review", label: "Review & Save" },
] as const;
type StepKey = (typeof STEPS)[number]["key"];

/* ══════════════════════════════════════════════════════════════════════
   MODULE-LEVEL COMPONENTS
══════════════════════════════════════════════════════════════════════ */

const FieldWrap = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
  <div>
    <Label className={error ? "text-destructive" : ""}>{label}</Label>
    {children}
    {error && <p className="text-xs text-destructive mt-1">{error}</p>}
  </div>
);

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
        <Calendar mode="single" selected={value} onSelect={onChange} initialFocus className="p-3 pointer-events-auto" />
      </PopoverContent>
    </Popover>
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

  // Personal
  const [firstName, setFirstName] = useState((ex.first_name as string) ?? "");
  const [middleName, setMiddleName] = useState((ex.middle_name as string) ?? "");
  const [lastName, setLastName] = useState((ex.last_name as string) ?? "");
  const [dob, setDob] = useState<Date | undefined>(ex.date_of_birth ? new Date(ex.date_of_birth as string) : undefined);
  const [gender, setGender] = useState((ex.gender as string) ?? "");
  const [cityOfBirth, setCityOfBirth] = useState((ex.city_of_birth as string) ?? "");

  // Contact
  const [email, setEmail] = useState((ex.student_email ?? ex.email ?? "") as string);
  const [phone, setPhone] = useState((ex.student_phone ?? ex.phone ?? "") as string);
  const [emergencyName, setEmergencyName] = useState(""); // explicitly empty
  const [emergencyPhone, setEmergencyPhone] = useState((ex.emergency_contact_phone as string) ?? "");
  const [street, setStreet] = useState((ex.street as string) ?? "");
  const [houseNo, setHouseNo] = useState((ex.house_no as string) ?? "");
  const [postcode, setPostcode] = useState((ex.postcode as string) ?? "");
  const [city, setCity] = useState((ex.city as string) ?? cd?.city ?? "");

  // Program
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

  // Accommodation
  const [accommodationId, setAccommodationId] = useState((ex.accommodation_id as string) ?? "");
  const [insuranceId, setInsuranceId] = useState((ex.insurance_id as string) ?? "");

  const age = dob ? differenceInYears(new Date(), dob) : null;
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ");
  const selectedProgram = programs.find((p) => p.id === programId);
  const filteredAccoms = accommodations.filter((a) => !schoolId || a.school_id === schoolId);
  const selectedAccom = accommodations.find((a) => a.id === accommodationId);
  const selectedIns = insurances.find((i) => i.id === insuranceId);

  /* ── Auto-fill program-related fields ────────────────────────────── */
  useEffect(() => {
    if (!programId) return;

    const program = programs.find((p) => p.id === programId);
    const school = schools.find((s) => s.id === schoolId);

    // Auto Course Start from fixed day + selected month
    if (program?.fixed_start_day_of_month && startMonth) {
      const [y, m] = startMonth.split("-").map(Number);
      const start = new Date(y, m - 1, program.fixed_start_day_of_month);
      setCourseStart(start);
      setCourseEnd(program.duration_in_months ? addMonths(start, program.duration_in_months) : undefined);
      const arrival = new Date(start);
      arrival.setDate(arrival.getDate() - 3); // example: 3 days before start
      setArrivalDate(arrival);
    }
  }, [programId, startMonth, schoolId, programs, schools]);

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

  /* ── Validation ─────────────────────────────────────────────────────── */
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

  /* ── Derived ────────────────────────────────────────────────────────── */
  const monthOptions = Array.from({ length: 24 }, (_, i) => {
    const d = addMonths(new Date(), i);
    return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy") };
  });

  const stepIdx = STEPS.findIndex((s) => s.key === step);
  const isLastStep = stepIdx === STEPS.length - 1;
  const isFirstStep = stepIdx === 0;

  /* ── Save ───────────────────────────────────────────────────────────── */
  const handleSave = async () => {
    const allErrs = { ...validate("personal"), ...validate("contact") };
    if (Object.keys(allErrs).length > 0) {
      setErrors(allErrs);
      toast({
        variant: "destructive",
        description: "Some required fields are missing. Please go back and complete them.",
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

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-5">
      {/* Step indicator */}
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
            <FieldWrap label="First Name" error={errors.firstName}>
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
            <FieldWrap label="Last Name" error={errors.lastName}>
              <Input
                className={cn("mt-1", errors.lastName && "border-destructive")}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </FieldWrap>
          </div>

          {/* Birthday input manual typing */}
          <div>
            <Label>Date of Birth</Label>
            <Input
              type="date"
              className="mt-1"
              value={dob ? format(dob, "yyyy-MM-dd") : ""}
              onChange={(e) => setDob(e.target.value ? new Date(e.target.value) : undefined)}
              placeholder="YYYY-MM-DD"
            />
            {dob && (
              <p className="text-xs text-muted-foreground mt-1">Age: {differenceInYears(new Date(), dob)} years</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FieldWrap label="Gender">
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </FieldWrap>
            <div>
              <Label>City of Birth</Label>
              <Input className="mt-1" value={cityOfBirth} onChange={(e) => setCityOfBirth(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      {/* Step navigation */}
      <div className="flex justify-between mt-5">
        {!isFirstStep && (
          <Button variant="outline" onClick={goBack}>
            Back
          </Button>
        )}
        {!isLastStep && <Button onClick={goNext}>Next</Button>}
        {isLastStep && (
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="animate-spin h-4 w-4 me-2" /> : null}
            Save
          </Button>
        )}
      </div>
    </div>
  );
}
