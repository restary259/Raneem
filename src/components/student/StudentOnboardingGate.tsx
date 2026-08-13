import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { isValidPhone } from "@/lib/studentProfileFields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BirthdayPicker } from "@/components/shared/BirthdayPicker";

interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
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
  university_name: string | null;
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

const EMPTY_PROFILE: ProfileShape = {
  full_name: null,
  phone_number: null,
  date_of_birth: null,
  gender: null,
  nationality: null,
  city: null,
  country: null,
  university_name: null,
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
  "full_name, phone_number, date_of_birth, gender, nationality, city, country, university_name, intake_month, arrival_date, passport_expiry, eye_color, has_changed_legal_name, previous_legal_name, has_criminal_record, criminal_record_details, has_dual_citizenship, second_passport_country, emergency_contacts, emergency_contact_name, emergency_contact_phone";

const EYE_COLORS = ["brown", "blue", "green", "hazel", "gray", "other"] as const;

const emptyContact = (): EmergencyContact => ({ name: "", relationship: "", phone: "" });

const filled = (v?: string | null) => !!v && v.trim().length >= 1;

const bool = (v: unknown) => v === true;

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
    filled(p.country) &&
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
      filled(p.country)
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
type TaskType = "text" | "tel" | "dob" | "gender" | "eye" | "date" | "switch-legal" | "contacts";

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
  { step: 0, key: "country", type: "text" },
  // step 1 — Study & arrival
  { step: 1, key: "university_name", type: "text" },
  { step: 1, key: "intake_month", type: "text" },
  { step: 1, key: "arrival_date", type: "date" },
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
    case "country": return "Address / country";
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
  return filled(p?.[task.key] as string) ? null : "studentOnboarding.errRequired";
};

/**
 * Blocks the student dashboard until the required profile is on file.
 * A four-step wizard: personal, study/arrival, legal/identity, emergency
 * contacts. Each step is persisted as it completes, so a student can leave
 * and resume without data loss.
 */
const StudentOnboardingGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation("dashboard");
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

  const load = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await (supabase as any)
      .from("profiles")
      .select(SELECT_COLUMNS)
      .eq("id", user.id)
      .maybeSingle();
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
      return {
        full_name: profile?.full_name,
        phone_number: profile?.phone_number,
        date_of_birth: profile?.date_of_birth,
        gender: profile?.gender,
        nationality: profile?.nationality,
        city: profile?.city,
        country: profile?.country,
      };
    }
    if (step === 1) {
      return {
        university_name: profile?.university_name,
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
    if (task.type === "dob" || task.type === "gender" || task.type === "eye") return;
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
  const progress = Math.round((taskIndex / (TASKS.length - 1)) * 100);
  const err = attempted ? taskErrorFor(task, profile, contacts) : null;

  const renderField = () => {
    switch (task.type) {
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
              className={cn("h-12 text-base", err && "border-destructive focus-visible:ring-destructive")}
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
              <SelectTrigger id="task-gender" className="h-12 text-base">
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
              <SelectTrigger id="task-eye_color" className="h-12 text-base">
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
              className={cn("h-12 text-base", err && "border-destructive focus-visible:ring-destructive")}
            />
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
                    className="h-12 text-base"
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
                <div key={i} className="space-y-3 rounded-lg border border-border p-3">
                  <div className="space-y-1.5">
                    <Label htmlFor={`ec-name-${i}`} className="text-destructive">
                      {t("studentOnboarding.contactName", "Name")} *
                    </Label>
                    <Input
                      id={`ec-name-${i}`}
                      value={c.name}
                      onChange={e => setContact(i, "name", e.target.value)}
                      autoComplete="off"
                      className={cn("h-11 text-base", nameErr && "border-destructive focus-visible:ring-destructive")}
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
                      className="h-11 text-base"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-1.5">
                      <Label htmlFor={`ec-phone-${i}`} className="text-destructive">
                        {t("studentOnboarding.contactPhone", "Phone")} *
                      </Label>
                      <Input
                        id={`ec-phone-${i}`}
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        value={c.phone}
                        onChange={e => setContact(i, "phone", e.target.value)}
                        className={cn("h-11 text-base", (phoneErr || phoneMissing) && "border-destructive focus-visible:ring-destructive")}
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
                </div>
              );
            })}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="mx-auto w-full max-w-md px-4 pt-6 pb-28 sm:pb-6">
      <Card>
        <CardHeader className="space-y-3">
          <div>
            <CardTitle className="text-lg">{t("studentOnboarding.title", "Complete your profile")}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("studentOnboarding.subtitle", "We need these details before your file can move forward.")}
            </p>
          </div>
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{stepLabel}</span>
              <span>{t("studentOnboarding.taskOf", { current: taskIndex + 1, total: TASKS.length })}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>{renderField()}</CardContent>
      </Card>

      {/* Sticky bottom nav so the primary action is always thumb-reachable on mobile. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:static sm:border-0 sm:bg-transparent sm:backdrop-blur-none sm:p-0">
        <div className="mx-auto flex w-full max-w-md items-center justify-between gap-3 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:py-0 sm:pb-6">
          <Button
            type="button"
            variant="ghost"
            onClick={back}
            disabled={taskIndex === 0 || saving}
            className="min-h-11"
          >
            <ArrowLeft className="me-1 h-4 w-4 rtl:rotate-180" />
            {t("studentOnboarding.back", "Back")}
          </Button>
          <Button onClick={next} disabled={saving} className="min-h-11 min-w-40">
            {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {isLastTask ? t("studentOnboarding.save", "Save and continue") : t("studentOnboarding.next", "Next")}
            {!isLastTask && <ArrowRight className="ms-1 h-4 w-4 rtl:rotate-180" />}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default StudentOnboardingGate;
