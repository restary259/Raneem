import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDirection } from "@/hooks/useDirection";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DashboardLoading from "@/components/dashboard/DashboardLoading";
import BankDetailsEditor from "@/components/common/BankDetailsEditor";
import { validatePassword } from "@/components/auth/PasswordStrength";
import { User, Lock } from "lucide-react";

interface AgentProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone_number: string | null;
  city: string | null;
}

/** Agent account settings: personal details, payout bank beneficiary, password. */
export default function AgentSettingsPage() {
  const { t } = useTranslation("dashboard");
  const { dir } = useDirection();
  const { user } = useAuth();
  const { toast } = useToast();

  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPw, setChangingPw] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("profiles")
      .select("id, full_name, email, phone_number, city")
      .eq("id", user.id)
      .maybeSingle();
    if (data) {
      setProfile(data as AgentProfile);
      setFullName(data.full_name ?? "");
      setPhone(data.phone_number ?? "");
      setCity(data.city ?? "");
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!user) return;
    if (!fullName.trim()) {
      toast({ variant: "destructive", description: t("partner.profile.nameRequired") });
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any)
      .from("profiles")
      .update({ full_name: fullName.trim(), phone_number: phone.trim() || null, city: city.trim() || null })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast({ variant: "destructive", title: t("common.error"), description: t("common.actionFailed") });
      return;
    }
    toast({ description: t("partner.profile.saved") });
    load();
  };

  const changePassword = async () => {
    if (!validatePassword(newPassword)) {
      toast({ variant: "destructive", description: t("partner.profile.weakPassword") });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ variant: "destructive", description: t("partner.profile.passwordMismatch") });
      return;
    }
    setChangingPw(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPw(false);
    if (error) {
      toast({ variant: "destructive", title: t("common.error"), description: t("common.actionFailed") });
      return;
    }
    setNewPassword("");
    setConfirmPassword("");
    toast({ description: t("partner.profile.passwordChanged") });
  };

  if (loading) return <DashboardLoading />;

  return (
    <div dir={dir} className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <User className="h-6 w-6 text-primary" />
          {t("agent.settingsTitle", "Account settings")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t("agent.settingsSubtitle", "Manage your agent account and payout details.")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("partner.profile.details", "Personal details")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("partner.profile.email", "Email")}</Label>
            <Input value={profile?.email ?? ""} disabled dir="ltr" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ag-name">{t("partner.profile.fullName", "Full name")}</Label>
            <Input id="ag-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ag-phone">{t("partner.profile.phone", "Phone")}</Label>
              <Input id="ag-phone" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ag-city">{t("partner.profile.city", "City")}</Label>
              <Input id="ag-city" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
          </div>
          <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        </CardContent>
      </Card>

      {user && <BankDetailsEditor userId={user.id} />}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            {t("partner.profile.changePassword", "Change password")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ag-pw">{t("partner.profile.newPassword", "New password")}</Label>
            <Input id="ag-pw" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} dir="ltr" />
            <p className="text-xs text-muted-foreground">{t("partner.profile.passwordHint", "At least 8 characters with letters and numbers.")}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ag-pw2">{t("partner.profile.confirmPassword", "Confirm password")}</Label>
            <Input id="ag-pw2" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} dir="ltr" />
          </div>
          <Button onClick={changePassword} disabled={changingPw} className="w-full sm:w-auto">
            {changingPw ? t("common.saving") : t("partner.profile.updatePassword", "Update password")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
