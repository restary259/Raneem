import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

/** A profile is complete once identity basics and two contacts are on file. */
export const isProfileComplete = (p: Partial<ProfileShape> | null | undefined) => {
  if (!p) return false;
  const filled = (v?: string | null) => !!v && v.trim().length > 1;
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
 * file. The gate is the only place this data is demanded, so an activated
 * student cannot slip past it by deep-linking to an inner route.
 */
const StudentOnboardingGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation("dashboard");
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  const save = async () => {
    const cleaned = contacts
      .map(c => ({ name: c.name.trim(), relationship: c.relationship.trim(), phone: c.phone.trim() }))
      .filter(c => c.name && c.phone);
    const candidate = { ...(profile as ProfileShape), emergency_contacts: cleaned };
    if (!isProfileComplete(candidate)) {
      toast({
        variant: "destructive",
        description: t("onboarding.incomplete", "Please fill every field and add two emergency contacts."),
      });
      return;
    }
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("profiles")
        .update({
          full_name: candidate.full_name,
          phone_number: candidate.phone_number,
          date_of_birth: candidate.date_of_birth,
          nationality: candidate.nationality,
          passport_number: candidate.passport_number,
          passport_expiry: candidate.passport_expiry || null,
          emergency_contacts: cleaned,
          emergency_contact_name: cleaned[0].name,
          emergency_contact_phone: cleaned[0].phone,
        })
        .eq("id", user!.id);
      if (error) throw error;
      setProfile(candidate);
      toast({ description: t("onboarding.saved", "Your details were saved.") });
    } catch (e: any) {
      toast({ variant: "destructive", description: e.message });
    } finally {
      setSaving(false);
    }
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

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>{t("onboarding.title", "Complete your profile")}</CardTitle>
          <CardDescription>
            {t(
              "onboarding.subtitle",
              "We need these details before your file can move forward. It only takes a minute.",
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {field("full_name", "onboarding.fullName", "Full name")}
            {field("phone_number", "onboarding.phone", "Phone number", "tel")}
            {field("date_of_birth", "onboarding.dob", "Date of birth", "date")}
            {field("nationality", "onboarding.nationality", "Nationality")}
            {field("passport_number", "onboarding.passportNumber", "Passport number")}
            {field("passport_expiry", "onboarding.passportExpiry", "Passport expiry", "date")}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                {t("onboarding.emergencyContacts", "Emergency contacts (at least two)")}
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setContacts(prev => [...prev, emptyContact()])}
              >
                <Plus className="me-1 h-4 w-4" />
                {t("onboarding.addContact", "Add contact")}
              </Button>
            </div>
            {contacts.map((c, i) => (
              <div key={i} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`ec-name-${i}`}>{t("onboarding.contactName", "Name")}</Label>
                  <Input
                    id={`ec-name-${i}`}
                    value={c.name}
                    onChange={e => setContact(i, "name", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`ec-rel-${i}`}>{t("onboarding.contactRelationship", "Relationship")}</Label>
                  <Input
                    id={`ec-rel-${i}`}
                    value={c.relationship}
                    onChange={e => setContact(i, "relationship", e.target.value)}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor={`ec-phone-${i}`}>{t("onboarding.contactPhone", "Phone")}</Label>
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
                      aria-label={t("onboarding.removeContact", "Remove contact")}
                      onClick={() => setContacts(prev => prev.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <Button onClick={save} disabled={saving} className="w-full">
            {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("onboarding.save", "Save and continue")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentOnboardingGate;
