import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, Check, Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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

const filled = (v?: string | null) => !!v && v.trim().length > 1;

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
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<ProfileShape | null>(null);
  const [contacts, setContacts] = useState<EmergencyContact[]>([emptyContact(), emptyContact()]);

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
      // Resume at the first incomplete step.
      for (let i = 0; i < 4; i++) {
        if (!stepComplete(merged, i)) {
          setStep(i);
          break;
        }
        if (i === 3) setStep(3);
      }
    } else {
      setProfile({ ...EMPTY_PROFILE });
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const complete = useMemo(() => isProfileComplete(profile), [profile]);

  const setField =
    (key: keyof ProfileShape) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setProfile(prev => ({ ...(prev as ProfileShape), [key]: e.target.value }));

  const setContact = (i: number, key: keyof EmergencyContact, value: string) =>
    setContacts(prev => prev.map((c, idx) => (idx === i ? { ...c, [key]: value } : c)));

  const cleanedContacts = () =>
    contacts
      .map(c => ({ name: c.name.trim(), relationship: c.relationship.trim(), phone: c.phone.trim() }))
      .filter(c => c.name && c.phone);

  /** Persists the current step's fields. Returns false when the write failed. */
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

  const next = async () => {
    if (!stepComplete(profile, step)) {
      toast({
        variant: "destructive",
        description:
          step === 3
            ? t("studentOnboarding.incompleteContacts", "Please add at least two emergency contacts with a name and phone number.")
            : t("studentOnboarding.incomplete", "Please complete every required field before continuing."),
      });
      return;
    }
    if (step === 0) {
      const ok = await persist({
        full_name: profile?.full_name,
        phone_number: profile?.phone_number,
        date_of_birth: profile?.date_of_birth,
        gender: profile?.gender,
        nationality: profile?.nationality,
        city: profile?.city,
        country: profile?.country,
      });
      if (!ok) return;
      setStep(1);
      return;
    }
    if (step === 1) {
      const ok = await persist({
        university_name: profile?.university_name,
        intake_month: profile?.intake_month,
        arrival_date: profile?.arrival_date || null,
      });
      if (!ok) return;
      setStep(2);
      return;
    }
    if (step === 2) {
      // Same data shape as StudentVisaPage.saveLegal — conditional fields null
      // out when their switch is off.
      const ok = await persist({
        eye_color: profile?.eye_color,
        passport_expiry: profile?.passport_expiry || null,
        has_changed_legal_name: !!profile?.has_changed_legal_name,
        previous_legal_name: profile?.has_changed_legal_name ? profile?.previous_legal_name : null,
        has_criminal_record: !!profile?.has_criminal_record,
        criminal_record_details: profile?.has_criminal_record ? profile?.criminal_record_details : null,
        has_dual_citizenship: !!profile?.has_dual_citizenship,
        second_passport_country: profile?.has_dual_citizenship ? profile?.second_passport_country : null,
      });
      if (!ok) return;
      setStep(3);
      return;
    }
    const cleaned = cleanedContacts();
    const candidate = { ...(profile as ProfileShape), emergency_contacts: cleaned };
    const ok = await persist({
      emergency_contacts: cleaned,
      emergency_contact_name: cleaned[0].name,
      emergency_contact_phone: cleaned[0].phone,
    });
    if (!ok) return;
    setProfile(candidate);
    toast({ description: t("studentOnboarding.saved", "Your details were saved.") });
    // Re-read the authoritative profile so the gate re-evaluates completeness
    // against the persisted server state and closes into the dashboard.
    await load();
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (complete) return <>{children}</>;

  const field = (
    key: keyof ProfileShape,
    label: string,
    fallback: string,
    type: string = "text",
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={key}>{t(label, fallback)}</Label>
      <Input
        id={key}
        type={type}
        value={(profile?.[key] as string) ?? ""}
        onChange={setField(key)}
        required
      />
    </div>
  );

  const steps = [
    t("studentOnboarding.step1", "Personal"),
    t("studentOnboarding.step2", "Study & arrival"),
    t("studentOnboarding.step3", "Legal & identity"),
    t("studentOnboarding.step4", "Emergency contacts"),
  ];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <Card>
        <CardHeader className="space-y-4">
          <div>
            <CardTitle>{t("studentOnboarding.title", "Complete your profile")}</CardTitle>
            <CardDescription>
              {t(
                "studentOnboarding.subtitle",
                "We need these details before your file can move forward.",
              )}
            </CardDescription>
          </div>
          <div className="space-y-3">
            <Progress value={((step + 1) / steps.length) * 100} className="h-2" />
            {/* Labeled stepper — mirrors ProfileCompletionForm. Logical props so
                it renders correctly in both Arabic (RTL) and English (LTR). */}
            <div className="flex items-center gap-1">
              {steps.map((label, i) => {
                const done = i < step;
                const current = i === step;
                return (
                  <React.Fragment key={label}>
                    <button
                      type="button"
                      onClick={() => setStep(i)}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all",
                        current
                          ? "bg-primary text-primary-foreground"
                          : done
                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                            : "bg-muted text-muted-foreground hover:bg-muted/80",
                      )}
                    >
                      {done ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <span className="w-3 text-center">{i + 1}</span>
                      )}
                      <span className="hidden sm:inline">{label}</span>
                    </button>
                    {i < steps.length - 1 && (
                      <div className={cn("flex-1 h-px", done ? "bg-emerald-300" : "bg-border")} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {field("full_name", "studentOnboarding.fullName", "Full name")}
              {field("phone_number", "studentOnboarding.phone", "Phone number", "tel")}
              {field("date_of_birth", "studentOnboarding.dob", "Date of birth", "date")}
              <div className="space-y-1.5">
                <Label htmlFor="gender">{t("studentOnboarding.gender", "Gender")}</Label>
                <Select
                  value={profile?.gender ?? ""}
                  onValueChange={v => setProfile(prev => ({ ...(prev as ProfileShape), gender: v }))}
                >
                  <SelectTrigger id="gender">
                    <SelectValue placeholder={t("studentOnboarding.selectGender", "Select gender")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">{t("studentOnboarding.genderMale", "Male")}</SelectItem>
                    <SelectItem value="female">{t("studentOnboarding.genderFemale", "Female")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {field("nationality", "studentOnboarding.nationality", "Nationality")}
              {field("city", "studentOnboarding.city", "City of birth")}
              {field("country", "studentOnboarding.country", "Address / country")}
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {field("university_name", "studentOnboarding.universityName", "Language school")}
              {field("intake_month", "studentOnboarding.intakeMonth", "Intake month")}
              {field("arrival_date", "studentOnboarding.arrivalDate", "Arrival date", "date")}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="eye_color">{t("studentOnboarding.eyeColor", "Eye color")}</Label>
                  <Select
                    value={profile?.eye_color ?? ""}
                    onValueChange={v => setProfile(prev => ({ ...(prev as ProfileShape), eye_color: v }))}
                  >
                    <SelectTrigger id="eye_color">
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
                </div>
                {field("passport_expiry", "studentOnboarding.passportExpiry", "Passport expiry", "date")}
              </div>

              {/* Changed legal name */}
              <div className="flex items-center justify-between py-1">
                <Label className="text-sm">
                  {t("studentOnboarding.hasChangedLegalName", "Have you ever changed your legal name?")}
                </Label>
                <Switch
                  checked={!!profile?.has_changed_legal_name}
                  onCheckedChange={v =>
                    setProfile(prev => ({ ...(prev as ProfileShape), has_changed_legal_name: v }))
                  }
                />
              </div>
              {profile?.has_changed_legal_name && (
                <div className="space-y-1.5">
                  <Label htmlFor="previous_legal_name">
                    {t("studentOnboarding.previousLegalName", "Previous legal name")}
                  </Label>
                  <Input
                    id="previous_legal_name"
                    value={profile?.previous_legal_name ?? ""}
                    onChange={setField("previous_legal_name")}
                  />
                </div>
              )}

              {/* Criminal record */}
              <div className="flex items-center justify-between py-1">
                <Label className="text-sm">
                  {t("studentOnboarding.hasCriminalRecord", "Do you have a criminal record?")}
                </Label>
                <Switch
                  checked={!!profile?.has_criminal_record}
                  onCheckedChange={v =>
                    setProfile(prev => ({ ...(prev as ProfileShape), has_criminal_record: v }))
                  }
                />
              </div>
              {profile?.has_criminal_record && (
                <div className="space-y-1.5">
                  <Label htmlFor="criminal_record_details">
                    {t("studentOnboarding.criminalRecordDetails", "Details")}
                  </Label>
                  <Textarea
                    id="criminal_record_details"
                    rows={2}
                    value={profile?.criminal_record_details ?? ""}
                    onChange={setField("criminal_record_details")}
                  />
                </div>
              )}

              {/* Dual citizenship */}
              <div className="flex items-center justify-between py-1">
                <Label className="text-sm">
                  {t("studentOnboarding.hasDualCitizenship", "Do you have dual citizenship?")}
                </Label>
                <Switch
                  checked={!!profile?.has_dual_citizenship}
                  onCheckedChange={v =>
                    setProfile(prev => ({ ...(prev as ProfileShape), has_dual_citizenship: v }))
                  }
                />
              </div>
              {profile?.has_dual_citizenship && (
                <div className="space-y-1.5">
                  <Label htmlFor="second_passport_country">
                    {t("studentOnboarding.secondPassportCountry", "Second passport country")}
                  </Label>
                  <Input
                    id="second_passport_country"
                    value={profile?.second_passport_country ?? ""}
                    onChange={setField("second_passport_country")}
                  />
                </div>
              )}
            </div>
          )}

          {step === 3 && (
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
              {contacts.map((c, i) => (
                <div key={i} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor={`ec-name-${i}`}>{t("studentOnboarding.contactName", "Name")}</Label>
                    <Input id={`ec-name-${i}`} value={c.name} onChange={e => setContact(i, "name", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`ec-rel-${i}`}>{t("studentOnboarding.contactRelationship", "Relationship")}</Label>
                    <Input
                      id={`ec-rel-${i}`}
                      value={c.relationship}
                      onChange={e => setContact(i, "relationship", e.target.value)}
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1 space-y-1.5">
                      <Label htmlFor={`ec-phone-${i}`}>{t("studentOnboarding.contactPhone", "Phone")}</Label>
                      <Input
                        id={`ec-phone-${i}`}
                        type="tel"
                        value={c.phone}
                        onChange={e => setContact(i, "phone", e.target.value)}
                      />
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
              ))}
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep(s => Math.max(0, s - 1))}
              disabled={step === 0 || saving}
            >
              <ArrowLeft className="me-1 h-4 w-4 rtl:rotate-180" />
              {t("studentOnboarding.back", "Back")}
            </Button>
            <Button onClick={next} disabled={saving} className="min-w-40">
              {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {step < 3 ? t("studentOnboarding.next", "Next") : t("studentOnboarding.save", "Save and continue")}
              {step < 3 && <ArrowRight className="ms-1 h-4 w-4 rtl:rotate-180" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentOnboardingGate;
