import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, Check, Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
}

interface ProfileShape {
  full_name: string | null;
  phone_number: string | null;
  date_of_birth: string | null;
  nationality: string | null;
  passport_number: string | null;
  passport_expiry: string | null;
  emergency_contacts: EmergencyContact[] | null;
}

const emptyContact = (): EmergencyContact => ({ name: "", relationship: "", phone: "" });

const filled = (v?: string | null) => !!v && v.trim().length > 1;

/** A profile is complete once identity basics and two contacts are on file. */
export const isProfileComplete = (p: Partial<ProfileShape> | null | undefined) => {
  if (!p) return false;
  const contacts = Array.isArray(p.emergency_contacts) ? p.emergency_contacts : [];
  const validContacts = contacts.filter(c => filled(c?.name) && filled(c?.phone));
  return (
    filled(p.full_name) &&
    filled(p.phone_number) &&
    filled(p.date_of_birth) &&
    filled(p.nationality) &&
    filled(p.passport_number) &&
    validContacts.length >= 2
  );
};

/**
 * Blocks the student dashboard until the required personal details are on
 * file. Presented as a three-step wizard: identity, travel document, then
 * emergency contacts. Every step is persisted as it is completed, so a
 * student can leave and come back without losing what they already typed.
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
      .select(
        "full_name, phone_number, date_of_birth, nationality, passport_number, passport_expiry, emergency_contacts",
      )
      .eq("id", user.id)
      .maybeSingle();
    if (data) {
      setProfile(data);
      const existing = Array.isArray(data.emergency_contacts) ? data.emergency_contacts : [];
      const seeded = [...existing.map((c: any) => ({ ...emptyContact(), ...c }))];
      while (seeded.length < 2) seeded.push(emptyContact());
      setContacts(seeded);
      // Resume where the student left off instead of always starting at step 1.
      if (
        filled(data.full_name) &&
        filled(data.phone_number) &&
        filled(data.date_of_birth) &&
        filled(data.nationality)
      ) {
        setStep(filled(data.passport_number) ? 2 : 1);
      }
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const complete = useMemo(() => isProfileComplete(profile), [profile]);

  const set = (key: keyof ProfileShape) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setProfile(prev => ({ ...(prev as ProfileShape), [key]: e.target.value }));

  const setContact = (i: number, key: keyof EmergencyContact, value: string) =>
    setContacts(prev => prev.map((c, idx) => (idx === i ? { ...c, [key]: value } : c)));

  const cleanedContacts = () =>
    contacts
      .map(c => ({ name: c.name.trim(), relationship: c.relationship.trim(), phone: c.phone.trim() }))
      .filter(c => c.name && c.phone);

  /** Persists whatever is valid so far. Returns false when the write failed. */
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

  const stepValid = (index: number) => {
    if (index === 0) {
      return (
        filled(profile?.full_name) &&
        filled(profile?.phone_number) &&
        filled(profile?.date_of_birth) &&
        filled(profile?.nationality)
      );
    }
    if (index === 1) return filled(profile?.passport_number);
    return cleanedContacts().length >= 2;
  };

  const next = async () => {
    if (!stepValid(step)) {
      toast({
        variant: "destructive",
        description: t("studentOnboarding.incomplete", "Please fill every field and add two emergency contacts."),
      });
      return;
    }
    if (step === 0) {
      const ok = await persist({
        full_name: profile?.full_name,
        phone_number: profile?.phone_number,
        date_of_birth: profile?.date_of_birth,
        nationality: profile?.nationality,
      });
      if (!ok) return;
      setStep(1);
      return;
    }
    if (step === 1) {
      const ok = await persist({
        passport_number: profile?.passport_number,
        passport_expiry: profile?.passport_expiry || null,
      });
      if (!ok) return;
      setStep(2);
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
        onChange={set(key)}
        required
      />
    </div>
  );

  const steps = [
    t("studentOnboarding.step1", "Personal details"),
    t("studentOnboarding.step2", "Travel document"),
    t("studentOnboarding.step3", "Emergency contacts"),
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
                "We need these details before your file can move forward. It only takes a minute.",
              )}
            </CardDescription>
          </div>
          <div className="space-y-2">
            <Progress value={((step + 1) / steps.length) * 100} className="h-2" />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {steps.map((label, i) => (
                <span key={label} className={i === step ? "font-semibold text-foreground" : undefined}>
                  {i < step && <Check className="me-1 inline h-3 w-3 text-primary" />}
                  {i + 1}. {label}
                </span>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {step === 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {field("full_name", "studentOnboarding.fullName", "Full name")}
              {field("phone_number", "studentOnboarding.phone", "Phone number", "tel")}
              {field("date_of_birth", "studentOnboarding.dob", "Date of birth", "date")}
              {field("nationality", "studentOnboarding.nationality", "Nationality")}
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {field("passport_number", "studentOnboarding.passportNumber", "Passport number")}
              {field("passport_expiry", "studentOnboarding.passportExpiry", "Passport expiry", "date")}
            </div>
          )}

          {step === 2 && (
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
              {step < 2 ? t("studentOnboarding.next", "Next") : t("studentOnboarding.save", "Save and continue")}
              {step < 2 && <ArrowRight className="ms-1 h-4 w-4 rtl:rotate-180" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentOnboardingGate;
