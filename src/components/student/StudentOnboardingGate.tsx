import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, GraduationCap, Link2, Loader2, Mail, Phone, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { isValidPhone } from "@/lib/studentProfileFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BirthdayPicker } from "@/components/shared/BirthdayPicker";
import { OnboardingShell } from "@/components/student/OnboardingShell";

interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

/** A contact returned by get_school_important_contacts for the wizard preview. */
interface PreviewContact {
  id: string;
  name_en: string;
  name_ar: string;
  role_en: string | null;
  role_ar: string | null;
  phone: string | null;
  email: string | null;
  link: string | null;
  match_scope: string;
}

/**
 * Full profile shape captured by the wizard. Mirrors the field set the admin
 * sidebar shows in AdminStudentsPage (PROFILE_SELECT), EXCLUDING the sensitive
 * passport_number — that is sourced externally now. passport_expiry is kept.
 */
interface ProfileShape {
  full_name: string | null;
  phone_number: string | null;
  date_of_birth: string | null;
  gender: string | null;
  nationality: string | null;
  city: string | null;
  country: string | null;
  street: string | null;
  house_number: string | null;
  residential_city: string | null;
  university_name: string | null;
  language_school_id: string | null;
  intake_month: string | null;
  arrival_date: string | null;
  passport_expiry: string | null;
  eye_color: string | null;
  has_changed_legal_name: boolean | null;
  previous_legal_name: string | null;
  has_criminal_record: boolean | null;
  criminal_record_details: string | null;
  has_dual_citizenship: boolean | null;
  second_passport_country: string | null;
  emergency_contacts: EmergencyContact[] | null;
}

// Default nationality for new students. The field stays editable in the wizard.
const DEFAULT_NATIONALITY = "Israel";

const EMPTY_PROFILE: ProfileShape = {
  full_name: null,
  phone_number: null,
  date_of_birth: null,
  gender: null,
  nationality: DEFAULT_NATIONALITY,
  city: null,
  country: null,
  street: null,
  house_number: null,
  residential_city: null,
  university_name: null,
  language_school_id: null,
  intake_month: null,
  arrival_date: null,
  passport_expiry: null,
  eye_color: null,
  has_changed_legal_name: false,
  previous_legal_name: null,
  has_criminal_record: false,
  criminal_record_details: null,
  has_dual_citizenship: false,
  second_passport_country: null,
  emergency_contacts: null,
};

// Single select of every column the wizard reads or writes — loaded once on
// mount, never re-fetched per keystroke.
const SELECT_COLUMNS =
  "full_name, phone_number, date_of_birth, gender, nationality, city, country, street, house_number, residential_city, university_name, language_school_id, intake_month, arrival_date, passport_expiry, eye_color, has_changed_legal_name, previous_legal_name, has_criminal_record, criminal_record_details, has_dual_citizenship, second_passport_country, emergency_contacts, emergency_contact_name, emergency_contact_phone";

const EYE_COLORS = ["brown", "blue", "green", "hazel", "gray", "other"] as const;

/** Year list for the arrival-date picker: current year through +6 (the wizard
 *  reuses the segmented BirthdayPicker style, but with future years). */
const ARRIVAL_YEARS = (() => {
  const now = new Date().getFullYear();
  return Array.from({ length: 7 }, (_, i) => String(now + i));
})();

const emptyContact = (): EmergencyContact => ({ name: "", relationship: "", phone: "" });

const filled = (v?: string | null) => !!v && v.trim().length >= 1;

const bool = (v: unknown) => v === true;

/** Structured home address is complete (street + house number + city). Legacy
 *  profiles that only filled the old single `country` text field are treated
 *  as complete too so they are not re-gated by the wizard. */
const hasAddress = (p: Partial<ProfileShape>) =>
  (filled(p.street) && filled(p.house_number) && filled(p.residential_city)) ||
  filled(p.country);

/** A profile is complete once every required sidebar field and two contacts are on file. */
export const isProfileComplete = (p: Partial<ProfileShape> | null | undefined) => {
  if (!p) return false;
  const contacts = Array.isArray(p.emergency_contacts) ? p.emergency_contacts : [];
  const validContacts = contacts.filter(c => filled(c?.name) && filled(c?.phone));
  return (
    filled(p.full_name) &&
    filled(p.phone_number) &&
    filled(p.date_of_birth) &&
    filled(p.gender) &&
    filled(p.nationality) &&
    filled(p.city) &&
    hasAddress(p) &&
    filled(p.university_name) &&
    filled(p.intake_month) &&
    filled(p.arrival_date) &&
    filled(p.passport_expiry) &&
    filled(p.eye_color) &&
    validContacts.length >= 2
  );
};

const stepComplete = (p: ProfileShape | null, index: number) => {
  if (!p) return false;
  if (index === 0) {
    return (
      filled(p.full_name) &&
      filled(p.phone_number) &&
      filled(p.date_of_birth) &&
      filled(p.gender) &&
      filled(p.nationality) &&
      filled(p.city) &&
      hasAddress(p)
    );
  }
  if (index === 1) {
    return filled(p.university_name) && filled(p.intake_month) && filled(p.arrival_date);
  }
  if (index === 2) {
    return filled(p.eye_color) && filled(p.passport_expiry);
  }
  const contacts = Array.isArray(p.emergency_contacts) ? p.emergency_contacts : [];
  return contacts.filter(c => filled(c?.name) && filled(c?.phone)).length >= 2;
};

/* ─────────────────────────── task model ───────────────────────────
 * The wizard is driven by a flat, ordered list of "tasks" — one field (or one
 * tightly-related group) per screen. Each task belongs to a logical step
 * (0-3); persistence still happens per logical step (the whole slice is saved
 * when the step's last task is completed), so the resume-at-first-incomplete
 * behavior is preserved.
 */
type TaskType = "text" | "tel" | "dob" | "gender" | "eye" | "date" | "arrival-date" | "address" | "switch-legal" | "contacts" | "school-select";

interface Task {
  step: number;
  key: keyof ProfileShape;
  type: TaskType;
  /** For switch-legal tasks: the conditional detail field shown when the switch is on. */
  detailKey?: keyof ProfileShape;
  detailType?: "text" | "textarea";
}

const TASKS: Task[] = [
  // step 0 — Personal
  { step: 0, key: "full_name", type: "text" },
  { step: 0, key: "phone_number", type: "tel" },
  { step: 0, key: "date_of_birth", type: "dob" },
  { step: 0, key: "gender", type: "gender" },
  { step: 0, key: "nationality", type: "text" },
  { step: 0, key: "city", type: "text" },
  { step: 0, key: "country", type: "address" },
  // step 1 — Study & arrival
  { step: 1, key: "university_name", type: "school-select" },
  { step: 1, key: "intake_month", type: "text" },
  { step: 1, key: "arrival_date", type: "arrival-date" },
  // step 2 — Legal & identity
  { step: 2, key: "eye_color", type: "eye" },
  { step: 2, key: "passport_expiry", type: "date" },
  { step: 2, key: "has_changed_legal_name", type: "switch-legal", detailKey: "previous_legal_name", detailType: "text" },
  { step: 2, key: "has_criminal_record", type: "switch-legal", detailKey: "criminal_record_details", detailType: "textarea" },
  { step: 2, key: "has_dual_citizenship", type: "switch-legal", detailKey: "second_passport_country", detailType: "text" },
  // step 3 — Emergency contacts
  { step: 3, key: "emergency_contacts", type: "contacts" },
];

/** Index of the last task belonging to a given logical step. */
const lastTaskIndexOfStep = (step: number): number => {
  for (let i = TASKS.length - 1; i >= 0; i--) if (TASKS[i].step === step) return i;
  return TASKS.length - 1;
};

/** Maps a profile field key to its studentOnboarding.* label key. */
const labelKeyFor = (key: keyof ProfileShape): string => {
  switch (key) {
    case "full_name": return "studentOnboarding.fullName";
    case "phone_number": return "studentOnboarding.phone";
    case "university_name": return "studentOnboarding.universityName";
    case "intake_month": return "studentOnboarding.intakeMonth";
    case "arrival_date": return "studentOnboarding.arrivalDate";
    case "passport_expiry": return "studentOnboarding.passportExpiry";
    case "nationality": return "studentOnboarding.nationality";
    case "city": return "studentOnboarding.city";
    case "country": return "studentOnboarding.country";
    case "street": return "studentOnboarding.street";
    case "house_number": return "studentOnboarding.houseNumber";
    case "residential_city": return "studentOnboarding.residentialCity";
    case "has_changed_legal_name": return "studentOnboarding.hasChangedLegalName";
    case "previous_legal_name": return "studentOnboarding.previousLegalName";
    case "has_criminal_record": return "studentOnboarding.hasCriminalRecord";
    case "criminal_record_details": return "studentOnboarding.criminalRecordDetails";
    case "has_dual_citizenship": return "studentOnboarding.hasDualCitizenship";
    case "second_passport_country": return "studentOnboarding.secondPassportCountry";
    default: return "studentOnboarding.fullName";
  }
};

/** English fallback for a profile field key (mirrors the existing locale strings). */
const labelFallbackFor = (key: keyof ProfileShape): string => {
  switch (key) {
    case "full_name": return "Full name";
    case "phone_number": return "Phone number";
    case "university_name": return "Language school";
    case "intake_month": return "Intake month";
    case "arrival_date": return "Arrival date";
    case "passport_expiry": return "Passport expiry";
    case "nationality": return "Nationality";
    case "city": return "City of birth";
    case "country": return "Address";
    case "street": return "Street";
    case "house_number": return "House number";
    case "residential_city": return "City";
    case "has_changed_legal_name": return "Have you ever changed your legal name?";
    case "previous_legal_name": return "Previous legal name";
    case "has_criminal_record": return "Do you have a criminal record?";
    case "criminal_record_details": return "Details";
    case "has_dual_citizenship": return "Do you have dual citizenship?";
    case "second_passport_country": return "Second passport country";
    default: return "Full name";
  }
};

/** Per-task error message (i18n key) for the current state, or null when valid. */
const taskErrorFor = (
  task: Task,
  p: ProfileShape | null,
  contactList: EmergencyContact[],
): string | null => {
  if (task.type === "contacts") {
    const valid = contactList.filter(c => filled(c.name) && filled(c.phone) && isValidPhone(c.phone));
    return valid.length >= 2 ? null : "studentOnboarding.errContactsMin";
  }
  if (task.type === "tel") {
    const v = (p?.[task.key] as string) ?? "";
    if (!filled(v)) return "studentOnboarding.errRequired";
    return isValidPhone(v) ? null : "studentOnboarding.errPhoneInvalid";
  }
  if (task.type === "switch-legal") {
    // Switches are optional; always valid (the detail field is never required).
    return null;
  }
  if (task.type === "address") {
    // Structured home address: street + house number + residential city.
    return filled(p?.street) && filled(p?.house_number) && filled(p?.residential_city)
      ? null
      : "studentOnboarding.errRequired";
  }
  return filled(p?.[task.key] as string) ? null : "studentOnboarding.errRequired";
};

/**
 * Blocks the student dashboard until the required profile is on file.
 * A four-step wizard: personal, study/arrival, legal/identity, emergency
 * contacts. Each step is persisted as it completes, so a student can leave
 * and resume without data loss.
 */
const StudentOnboardingGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t, i18n } = useTranslation("dashboard");
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [taskIndex, setTaskIndex] = useState(0);
  const [profile, setProfile] = useState<ProfileShape | null>(null);
  const [contacts, setContacts] = useState<EmergencyContact[]>([emptyContact(), emptyContact()]);
  /** Inline errors are only surfaced after the student attempts to advance. */
  const [attempted, setAttempted] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // Active language schools for the onboarding dropdown + live preview of the
  // contacts that apply to the selected school (universal + school/city).
  const [schools, setSchools] = useState<{ id: string; name_ar: string; name_en: string; city: string | null }[]>([]);
  const [previewContacts, setPreviewContacts] = useState<PreviewContact[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const [profileRes, schoolsRes] = await Promise.all([
      (supabase as any)
        .from("profiles")
        .select(SELECT_COLUMNS)
        .eq("id", user.id)
        .maybeSingle(),
      (supabase as any)
        .from("schools")
        .select("id,name_ar,name_en,city")
        .eq("is_active", true)
        .order("name_en"),
    ]);
    const data = profileRes.data;
    setSchools((schoolsRes.data as { id: string; name_ar: string; name_en: string; city: string | null }[]) ?? []);
    if (data) {
      const merged: ProfileShape = {
        ...EMPTY_PROFILE,
        ...data,
        has_changed_legal_name: bool(data.has_changed_legal_name),
        has_criminal_record: bool(data.has_criminal_record),
        has_dual_citizenship: bool(data.has_dual_citizenship),
      };
      setProfile(merged);
      const existing = Array.isArray(data.emergency_contacts) ? data.emergency_contacts : [];
      const seeded = [...existing.map((c: any) => ({ ...emptyContact(), ...c }))];
      while (seeded.length < 2) seeded.push(emptyContact());
      setContacts(seeded);
      // Resume at the first incomplete step, then at the first incomplete task
      // within that step so the student lands on exactly the field they missed.
      let resumeStep = 0;
      for (let i = 0; i < 4; i++) {
        if (!stepComplete(merged, i)) {
          resumeStep = i;
          break;
        }
        if (i === 3) resumeStep = 3;
      }
      const firstInvalidTask = TASKS.findIndex(
        task => task.step >= resumeStep && taskErrorFor(task, merged, seeded) !== null,
      );
      setTaskIndex(firstInvalidTask >= 0 ? firstInvalidTask : TASKS.length - 1);
    } else {
      setProfile({ ...EMPTY_PROFILE });
      setTaskIndex(0);
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const complete = useMemo(() => isProfileComplete(profile), [profile]);

  // Live preview: when the student picks a school, fetch the contacts that
  // apply to it (universal + school/city scoped) via the same RPC the real
  // Important Contacts page uses. No filtering happens client-side.
  const schoolId = profile?.language_school_id ?? null;
  useEffect(() => {
    if (!schoolId) {
      setPreviewContacts([]);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    (supabase as any)
      .rpc("get_school_important_contacts", { p_school_id: schoolId })
      .then((res: any) => {
        if (!cancelled) setPreviewContacts((res.data as PreviewContact[]) ?? []);
      })
      .finally(() => { if (!cancelled) setPreviewLoading(false); });
    return () => { cancelled = true; };
  }, [schoolId]);

  const setField =
    (key: keyof ProfileShape) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setProfile(prev => ({ ...(prev as ProfileShape), [key]: e.target.value }));
        setAttempted(false);
      };

  const setContact = (i: number, key: keyof EmergencyContact, value: string) => {
    setContacts(prev => prev.map((c, idx) => (idx === i ? { ...c, [key]: value } : c)));
    setAttempted(false);
  };

  const cleanedContacts = () =>
    contacts
      .map(c => ({ name: c.name.trim(), relationship: c.relationship.trim(), phone: c.phone.trim() }))
      .filter(c => c.name && c.phone);

  /** Persists a step's slice. Returns false when the write failed. */
  const persist = async (patch: Record<string, unknown>) => {
    setSaving(true);
    try {
      const { error } = await (supabase as any).from("profiles").update(patch).eq("id", user!.id);
      if (error) throw error;
      return true;
    } catch (e: any) {
      toast({ variant: "destructive", description: e.message });
      return false;
    } finally {
      setSaving(false);
    }
  };

  /** The DB patch written when a logical step completes (mirrors the original per-step persist). */
  const stepPatch = (step: number): Record<string, unknown> => {
    if (step === 0) {
      // Derive the legacy combined `country` string from the structured fields so
      // every existing reader (AdminStudentsPage "Address / Country",
      // StudentProfile home_address) keeps working unchanged.
      const street = profile?.street ?? "";
      const house = profile?.house_number ?? "";
      const resCity = profile?.residential_city ?? "";
      const combined = [`${street} ${house}`.trim(), resCity].filter(Boolean).join(", ");
      return {
        full_name: profile?.full_name,
        phone_number: profile?.phone_number,
        date_of_birth: profile?.date_of_birth,
        gender: profile?.gender,
        nationality: profile?.nationality,
        city: profile?.city,
        street: profile?.street,
        house_number: profile?.house_number,
        residential_city: profile?.residential_city,
        country: combined || null,
      };
    }
    if (step === 1) {
      return {
        university_name: profile?.university_name,
        language_school_id: profile?.language_school_id,
        intake_month: profile?.intake_month,
        arrival_date: profile?.arrival_date || null,
      };
    }
    // step 2 — conditional fields null out when their switch is off (StudentVisaPage.saveLegal shape).
    return {
      eye_color: profile?.eye_color,
      passport_expiry: profile?.passport_expiry || null,
      has_changed_legal_name: !!profile?.has_changed_legal_name,
      previous_legal_name: profile?.has_changed_legal_name ? profile?.previous_legal_name : null,
      has_criminal_record: !!profile?.has_criminal_record,
      criminal_record_details: profile?.has_criminal_record ? profile?.criminal_record_details : null,
      has_dual_citizenship: !!profile?.has_dual_citizenship,
      second_passport_country: profile?.has_dual_citizenship ? profile?.second_passport_country : null,
    };
  };

  const task = TASKS[taskIndex];
  const isLastTask = taskIndex === TASKS.length - 1;
  const isLastOfStep = taskIndex === lastTaskIndexOfStep(task.step);

  const next = async () => {
    const err = taskErrorFor(task, profile, contacts);
    if (err) {
      setAttempted(true);
      toast({ variant: "destructive", description: t(err, err) });
      return;
    }
    // Final task → persist contacts, re-read authoritative profile, close the gate.
    if (isLastTask) {
      const cleaned = cleanedContacts();
      const candidate = { ...(profile as ProfileShape), emergency_contacts: cleaned };
      const ok = await persist({
        emergency_contacts: cleaned,
        emergency_contact_name: cleaned[0]?.name,
        emergency_contact_phone: cleaned[0]?.phone,
      });
      if (!ok) return;
      setProfile(candidate);
      toast({ description: t("studentOnboarding.saved", "Your details were saved.") });
      await load();
      return;
    }
    // Leaving the last task of a logical step → persist that step's slice.
    if (isLastOfStep) {
      const ok = await persist(stepPatch(task.step));
      if (!ok) return;
    }
    setAttempted(false);
    setTaskIndex(i => i + 1);
  };

  const back = () => {
    setAttempted(false);
    setTaskIndex(i => Math.max(0, i - 1));
  };

  // Auto-focus the active input/select when the task changes.
  useEffect(() => {
    if (task.type === "dob" || task.type === "arrival-date" || task.type === "gender" || task.type === "eye" || task.type === "school-select" || task.type === "address") return;
    const id = `task-${task.key}`;
    const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
    if (el) {
      inputRef.current = el;
      el.focus();
    }
  }, [taskIndex, task]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (complete) return <>{children}</>;

  const steps = [
    t("studentOnboarding.step1", "Personal"),
    t("studentOnboarding.step2", "Study & arrival"),
    t("studentOnboarding.step3", "Legal & identity"),
    t("studentOnboarding.step4", "Emergency contacts"),
  ];

  const stepLabel = steps[task.step];
  const err = attempted ? taskErrorFor(task, profile, contacts) : null;

  // Per-task headline + short explanation. Falls back to the flat field label
  // when no friendly copy exists (switch-legal detail fields, etc.).
  const headlineKeyFor = (key: keyof ProfileShape): string => {
    if (key in { full_name: 1, phone_number: 1, date_of_birth: 1, gender: 1, nationality: 1, city: 1, country: 1, university_name: 1, intake_month: 1, arrival_date: 1, eye_color: 1, passport_expiry: 1, has_changed_legal_name: 1, has_criminal_record: 1, has_dual_citizenship: 1, emergency_contacts: 1 }) {
      return `studentOnboarding.q.${key}`;
    }
    return "";
  };
  const headlineFallbackFor = (key: keyof ProfileShape): string => {
    const m: Record<string, string> = {
      full_name: "What's your full name?",
      phone_number: "What's your phone number?",
      date_of_birth: "When's your birthday?",
      gender: "What's your gender?",
      nationality: "What's your nationality?",
      city: "Where were you born?",
      country: "Where do you live now?",
      university_name: "Which language school will you attend?",
      intake_month: "Which intake are you joining?",
      arrival_date: "When do you arrive in Germany?",
      eye_color: "What's your eye color?",
      passport_expiry: "When does your passport expire?",
      has_changed_legal_name: "Have you ever changed your legal name?",
      has_criminal_record: "Do you have a criminal record?",
      has_dual_citizenship: "Do you hold dual citizenship?",
      emergency_contacts: "Who should we contact in an emergency?",
    };
    return m[key] ?? labelFallbackFor(key);
  };
  const descriptionKeyFor = (key: keyof ProfileShape): string => `studentOnboarding.q.${key}Desc`;
  const descriptionFallbackFor = (key: keyof ProfileShape): string => {
    const m: Record<string, string> = {
      full_name: "Use your name exactly as it appears on your passport — it's used for all official documents.",
      phone_number: "We'll send your appointment reminders and case updates here.",
      date_of_birth: "German universities verify age against your passport at enrollment, so this needs to match exactly.",
      gender: "Required for your visa application and university enrollment.",
      nationality: "This determines your visa requirements and application path.",
      city: "Your city of birth as shown on your passport.",
      country: "Your current address — where correspondence should reach you.",
      university_name: "Choose your school — the contacts and requirements shown will adapt to your selection.",
      intake_month: "The month you start your language program.",
      arrival_date: "Your planned arrival date — we'll time your appointments around it.",
      eye_color: "Listed on your residence permit and biometric documents.",
      passport_expiry: "Your passport must be valid for the duration of your studies.",
      emergency_contacts: "Add at least two people we can reach if something happens to you while in Germany.",
    };
    return m[key] ?? "";
  };

  const headlineKey = headlineKeyFor(task.key);
  const taskTitle = headlineKey
    ? t(headlineKey, headlineFallbackFor(task.key))
    : t(`studentOnboarding.${labelKeyFor(task.key)}`, labelFallbackFor(task.key));
  const taskDesc = descriptionFallbackFor(task.key)
    ? t(descriptionKeyFor(task.key), descriptionFallbackFor(task.key))
    : null;

  // Which section comes after the current one (for the "X next" context label).
  const nextSectionLabel = task.step < 3 ? steps[task.step + 1] : null;
  const nextSection = nextSectionLabel
    ? t("studentOnboarding.sectionNext", { section: nextSectionLabel })
    : null;

  const stepsRemaining = TASKS.length - 1 - taskIndex;
  const remainingNote =
    stepsRemaining > 1
      ? t("studentOnboarding.stepsRemaining", { count: stepsRemaining })
      : stepsRemaining === 1
        ? t("studentOnboarding.stepsRemainingOne", "1 step to go")
        : null;

  const renderField = () => {
    switch (task.type) {
      case "school-select": {
        const isAr = i18n.language === "ar";
        return (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="task-university_name">
                {t(`studentOnboarding.${labelKeyFor(task.key)}`, labelFallbackFor(task.key))}
              </Label>
              <Select
                value={profile?.language_school_id ?? ""}
                onValueChange={v => {
                  const sch = schools.find(s => s.id === v);
                  setProfile(prev => ({
                    ...(prev as ProfileShape),
                    language_school_id: v,
                    // Keep the text name in sync so the admin sidebar / legacy
                    // readers that read university_name still show the school.
                    university_name: sch ? (isAr ? sch.name_ar : sch.name_en) : null,
                  }));
                  setAttempted(false);
                }}
              >
                <SelectTrigger id="task-university_name">
                  <SelectValue placeholder={t("studentOnboarding.selectSchool", "Select your language school")} />
                </SelectTrigger>
                <SelectContent>
                  {schools.length === 0 ? (
                    <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                      {t("studentOnboarding.noSchools", "No language schools are configured yet. Please contact the admin to add your school, then refresh this page.")}
                    </div>
                  ) : (
                    schools.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {isAr ? s.name_ar : s.name_en}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {err && <p className="text-xs text-destructive">{t(err, err)}</p>}
            </div>

            {/* Live preview of the contacts available at the selected school. */}
            {schoolId && (
              <div className="rounded-xl border border-border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-primary" />
                  <h4 className="text-sm font-semibold">{t("studentOnboarding.schoolContacts", "Your school contacts")}</h4>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("studentOnboarding.schoolContactsHint", "These are the important contacts available to students at your school.")}
                </p>
                {previewLoading ? (
                  <p className="text-xs text-muted-foreground py-2">{t("studentOnboarding.schoolLoading", "Loading school contacts…")}</p>
                ) : previewContacts.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">{t("studentOnboarding.noSchoolContacts", "No school-specific contacts yet. Universal contacts are shown below.")}</p>
                ) : (
                  <ul className="space-y-1.5">
                    {previewContacts.slice(0, 6).map(c => (
                      <li key={c.id} className="rounded-lg bg-muted/50 px-3 py-2">
                        <p className="text-sm font-medium text-foreground">{isAr ? c.name_ar : c.name_en}</p>
                        {(isAr ? c.role_ar : c.role_en) && (
                          <p className="text-xs text-muted-foreground">{isAr ? c.role_ar : c.role_en}</p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-1">
                          {c.phone && <span className="inline-flex items-center gap-1 text-xs text-primary"><Phone className="h-3 w-3" />{c.phone}</span>}
                          {c.email && <span className="inline-flex items-center gap-1 text-xs text-primary"><Mail className="h-3 w-3" />{c.email}</span>}
                          {c.link && <span className="inline-flex items-center gap-1 text-xs text-primary"><Link2 className="h-3 w-3" />{t("contacts.officialSite", "Official website")}</span>}
                        </div>
                      </li>
                    ))}
                    {previewContacts.length > 6 && (
                      <li className="text-xs text-muted-foreground pt-1">
                        {t("studentOnboarding.taskOf", { current: 6, total: previewContacts.length })}…
                      </li>
                    )}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      }
      case "text":
      case "tel":
        return (
          <div className="space-y-2">
            <Label htmlFor={`task-${task.key}`}>{t(`studentOnboarding.${labelKeyFor(task.key)}`, labelFallbackFor(task.key))}</Label>
            <Input
              id={`task-${task.key}`}
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type={task.type === "tel" ? "tel" : "text"}
              inputMode={task.type === "tel" ? "tel" : undefined}
              autoComplete={task.type === "tel" ? "tel" : task.key === "full_name" ? "name" : "off"}
              enterKeyHint="next"
              value={(profile?.[task.key] as string) ?? ""}
              onChange={setField(task.key)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); next(); } }}
              className={cn(err && "border-destructive focus-visible:ring-destructive")}
              placeholder={task.type === "tel" ? t("studentOnboarding.ph.phone", "+972…") : undefined}
            />
            {err && <p className="text-xs text-destructive">{t(err, err)}</p>}
          </div>
        );
      case "dob":
        return (
          <BirthdayPicker
            id={`task-${task.key}`}
            label={t("studentOnboarding.dob", "Date of birth")}
            value={profile?.date_of_birth ?? ""}
            onChange={iso => { setProfile(prev => ({ ...(prev as ProfileShape), date_of_birth: iso })); setAttempted(false); }}
            phYear={t("studentOnboarding.ph.year", "Year")}
            phMonth={t("studentOnboarding.ph.month", "Month")}
            phDay={t("studentOnboarding.ph.day", "Day")}
            ageLabel={age => t("studentOnboarding.age", { count: age })}
          />
        );
      case "gender":
        return (
          <div className="space-y-2">
            <Label htmlFor="task-gender">{t("studentOnboarding.gender", "Gender")}</Label>
            <Select
              value={profile?.gender ?? ""}
              onValueChange={v => { setProfile(prev => ({ ...(prev as ProfileShape), gender: v })); setAttempted(false); }}
            >
              <SelectTrigger id="task-gender">
                <SelectValue placeholder={t("studentOnboarding.selectGender", "Select gender")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">{t("studentOnboarding.genderMale", "Male")}</SelectItem>
                <SelectItem value="female">{t("studentOnboarding.genderFemale", "Female")}</SelectItem>
              </SelectContent>
            </Select>
            {err && <p className="text-xs text-destructive">{t(err, err)}</p>}
          </div>
        );
      case "eye":
        return (
          <div className="space-y-2">
            <Label htmlFor="task-eye_color">{t("studentOnboarding.eyeColor", "Eye color")}</Label>
            <Select
              value={profile?.eye_color ?? ""}
              onValueChange={v => { setProfile(prev => ({ ...(prev as ProfileShape), eye_color: v })); setAttempted(false); }}
            >
              <SelectTrigger id="task-eye_color">
                <SelectValue placeholder={t("studentOnboarding.selectEyeColor", "Select eye color")} />
              </SelectTrigger>
              <SelectContent>
                {EYE_COLORS.map(c => (
                  <SelectItem key={c} value={c}>
                    {t(`studentOnboarding.eyeColors.${c}`, c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {err && <p className="text-xs text-destructive">{t(err, err)}</p>}
          </div>
        );
      case "date":
        return (
          <div className="space-y-2">
            <Label htmlFor={`task-${task.key}`}>
              {t(`studentOnboarding.${labelKeyFor(task.key)}`, labelFallbackFor(task.key))}
            </Label>
            <Input
              id={`task-${task.key}`}
              type="date"
              value={(profile?.[task.key] as string) ?? ""}
              onChange={setField(task.key)}
              className={cn(err && "border-destructive focus-visible:ring-destructive")}
            />
            {err && <p className="text-xs text-destructive">{t(err, err)}</p>}
          </div>
        );
      case "arrival-date":
        return (
          <BirthdayPicker
            id={`task-${task.key}`}
            label={t("studentOnboarding.arrivalDate", "Arrival date")}
            value={profile?.arrival_date ?? ""}
            onChange={iso => { setProfile(prev => ({ ...(prev as ProfileShape), arrival_date: iso })); setAttempted(false); }}
            phYear={t("studentOnboarding.ph.year", "Year")}
            phMonth={t("studentOnboarding.ph.month", "Month")}
            phDay={t("studentOnboarding.ph.day", "Day")}
            years={ARRIVAL_YEARS}
          />
        );
      case "address":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="task-street">{t("studentOnboarding.street", "Street")}</Label>
                <Input
                  id="task-street"
                  value={profile?.street ?? ""}
                  onChange={e => { setProfile(prev => ({ ...(prev as ProfileShape), street: e.target.value })); setAttempted(false); }}
                  className={cn(err && !filled(profile?.street) && "border-destructive focus-visible:ring-destructive")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="task-house_number">{t("studentOnboarding.houseNumber", "House number")}</Label>
                <Input
                  id="task-house_number"
                  value={profile?.house_number ?? ""}
                  onChange={e => { setProfile(prev => ({ ...(prev as ProfileShape), house_number: e.target.value })); setAttempted(false); }}
                  className={cn(err && !filled(profile?.house_number) && "border-destructive focus-visible:ring-destructive")}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-residential_city">{t("studentOnboarding.residentialCity", "City")}</Label>
              <Input
                id="task-residential_city"
                value={profile?.residential_city ?? ""}
                onChange={e => { setProfile(prev => ({ ...(prev as ProfileShape), residential_city: e.target.value })); setAttempted(false); }}
                className={cn(err && !filled(profile?.residential_city) && "border-destructive focus-visible:ring-destructive")}
              />
            </div>
            {err && <p className="text-xs text-destructive">{t(err, err)}</p>}
          </div>
        );
      case "switch-legal":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-4">
              <Label className="text-base">
                {t(`studentOnboarding.${labelKeyFor(task.key)}`, labelFallbackFor(task.key))}
              </Label>
              <Switch
                checked={!!(profile?.[task.key] as boolean)}
                onCheckedChange={v => {
                  setProfile(prev => ({ ...(prev as ProfileShape), [task.key]: v }));
                  setAttempted(false);
                }}
              />
            </div>
            {profile?.[task.key] && task.detailKey && (
              <div className="space-y-2">
                <Label htmlFor={`task-${task.detailKey}`}>
                  {t(`studentOnboarding.${labelKeyFor(task.detailKey)}`, labelFallbackFor(task.detailKey))}
                </Label>
                {task.detailType === "textarea" ? (
                  <Textarea
                    id={`task-${task.detailKey}`}
                    ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                    rows={3}
                    value={(profile?.[task.detailKey] as string) ?? ""}
                    onChange={setField(task.detailKey)}
                    className="text-base"
                  />
                ) : (
                  <Input
                    id={`task-${task.detailKey}`}
                    ref={inputRef as React.RefObject<HTMLInputElement>}
                    value={(profile?.[task.detailKey] as string) ?? ""}
                    onChange={setField(task.detailKey)}
                    enterKeyHint="next"
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); next(); } }}
                   
                  />
                )}
              </div>
            )}
          </div>
        );
      case "contacts":
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                {t("studentOnboarding.emergencyContacts", "Emergency contacts (at least two)")}
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setContacts(prev => [...prev, emptyContact()])}
              >
                <Plus className="me-1 h-4 w-4" />
                {t("studentOnboarding.addContact", "Add contact")}
              </Button>
            </div>
            {err && <p className="text-xs text-destructive">{t(err, err)}</p>}
            {contacts.map((c, i) => {
              const nameErr = attempted && !filled(c.name);
              const phoneErr = attempted && filled(c.phone) && !isValidPhone(c.phone);
              const phoneMissing = attempted && !filled(c.phone);
              return (
                <Card key={i}>
                  <CardContent className="space-y-3 p-4">
                  <div className="space-y-1.5">
                    <Label htmlFor={`ec-name-${i}`}>
                      {t("studentOnboarding.contactName", "Name")} <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id={`ec-name-${i}`}
                      value={c.name}
                      onChange={e => setContact(i, "name", e.target.value)}
                      autoComplete="off"
                      className={cn(nameErr && "border-destructive focus-visible:ring-destructive")}
                    />
                    {nameErr && <p className="text-xs text-destructive">{t("studentOnboarding.errRequired", "This field is required")}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`ec-rel-${i}`}>
                      {t("studentOnboarding.contactRelationship", "Relationship")}
                    </Label>
                    <Input
                      id={`ec-rel-${i}`}
                      value={c.relationship}
                      onChange={e => setContact(i, "relationship", e.target.value)}
                      autoComplete="off"
                     
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-1.5">
                      <Label htmlFor={`ec-phone-${i}`}>
                        {t("studentOnboarding.contactPhone", "Phone")} <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id={`ec-phone-${i}`}
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        value={c.phone}
                        onChange={e => setContact(i, "phone", e.target.value)}
                        className={cn((phoneErr || phoneMissing) && "border-destructive focus-visible:ring-destructive")}
                      />
                      {phoneMissing && <p className="text-xs text-destructive">{t("studentOnboarding.errRequired", "This field is required")}</p>}
                      {phoneErr && <p className="text-xs text-destructive">{t("studentOnboarding.errPhoneInvalid", "Invalid phone number (7–15 digits)")}</p>}
                    </div>
                    {contacts.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t("studentOnboarding.removeContact", "Remove contact")}
                        onClick={() => setContacts(prev => prev.filter((_, idx) => idx !== i))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <OnboardingShell
      stepIndex={taskIndex}
      totalSteps={TASKS.length}
      section={stepLabel}
      nextSection={nextSection}
      journeyStart={t("studentOnboarding.journeyStart", "Start")}
      journeyEnd={t("studentOnboarding.journeyEnd", "DE")}
      title={taskTitle}
      description={taskDesc}
      onBack={taskIndex === 0 ? null : back}
      disabled={saving}
      footer={
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={back}
              disabled={taskIndex === 0 || saving}
              className="shrink-0"
            >
              <ArrowLeft className="me-1 h-4 w-4 rtl:rotate-180" />
              {t("studentOnboarding.back", "Back")}
            </Button>
            <Button
              onClick={next}
              disabled={saving}
              className="flex-1"
            >
              {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {isLastTask
                ? t("studentOnboarding.save", "Save and continue")
                : t("studentOnboarding.continue", "Continue")}
              {!isLastTask && <ArrowRight className="ms-1.5 h-4 w-4 rtl:rotate-180" />}
            </Button>
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            {remainingNote && <span>{remainingNote}</span>}
            {remainingNote && <span aria-hidden>·</span>}
            <span>{t("studentOnboarding.savedAutomatically", "Saved automatically")}</span>
          </div>
        </div>
      }
    >
      {renderField()}
    </OnboardingShell>
  );
};

export default StudentOnboardingGate;
