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
import { validatePassword } from "@/components/auth/PasswordStrength";
import { buildReferralUrl } from "@/lib/referral";
import { User, Lock, Link2, Copy, Check, ChevronRight } from "lucide-react";
import { changeOwnPassword } from "@/lib/changeOwnPassword";

interface PartnerProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone_number: string | null;
  city: string | null;
  referral_code: string | null;
  referral_code_enabled: boolean | null;
}

/** Partner / ambassador account surface: personal details, referral link and password. */
export default function PartnerProfilePage() {
  const { t } = useTranslation("dashboard");
  const { dir } = useDirection();
  const { user } = useAuth();
  const { toast } = useToast();

  const [profile, setProfile] = useState<PartnerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPw, setChangingPw] = useState(false);
  const [editingPersonal, setEditingPersonal] = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("profiles")
      .select("id, full_name, email, phone_number, city, referral_code, referral_code_enabled")
      .eq("id", user.id)
      .maybeSingle();
    if (data) {
      setProfile(data as PartnerProfile);
      setFullName(data.full_name ?? "");
      setPhone(data.phone_number ?? "");
      setCity(data.city ?? "");
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

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
    setEditingPersonal(false);
  };

  const cancelPersonal = () => {
    setFullName(profile?.full_name ?? "");
    setPhone(profile?.phone_number ?? "");
    setCity(profile?.city ?? "");
    setEditingPersonal(false);
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
    try {
      await changeOwnPassword(newPassword);
    } catch {
      setChangingPw(false);
      toast({ variant: "destructive", title: t("common.error"), description: t("common.actionFailed") });
      return;
    }
    setChangingPw(false);
    setNewPassword("");
    setConfirmPassword("");
    toast({ description: t("partner.profile.passwordChanged") });
    setEditingPassword(false);
  };

  const cancelPassword = () => {
    setNewPassword("");
    setConfirmPassword("");
    setEditingPassword(false);
  };

  if (loading) return <DashboardLoading />;

  // Hide the link when the partner's referral code is disabled — a disabled code
  // cannot be resolved server-side (resolve_referral_code / check_referral_code
  // both gate on referral_code_enabled), so handing the partner a link that
  // silently fails to attribute would mislead them.
  const referralEnabled = profile?.referral_code_enabled !== false;
  const referralUrl = profile?.referral_code && referralEnabled
    ? buildReferralUrl(profile.referral_code)
    : null;

  const copyLink = async () => {
    if (!referralUrl) return;
    await navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div dir={dir} className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <User className="h-6 w-6 text-primary" />
          {t("partner.profile.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t("partner.profile.subtitle")}</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            {t("partner.profile.details")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!editingPersonal ? (
            <>
              <p className="text-sm text-muted-foreground mb-3">
                {t("partner.profile.detailsPreview", "Your name, email, phone and city.")}
              </p>
              <Button variant="outline" className="gap-2" onClick={() => setEditingPersonal(true)}>
                {t("partner.profile.managePersonalDetails", "Manage personal details")}
                <ChevronRight className="h-4 w-4 rtl:rotate-180" />
              </Button>
            </>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t("partner.profile.email")}</Label>
                <Input value={profile?.email ?? ""} disabled dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pp-name">{t("partner.profile.fullName")}</Label>
                <Input id="pp-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="pp-phone">{t("partner.profile.phone")}</Label>
                  <Input id="pp-phone" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pp-city">{t("partner.profile.city")}</Label>
                  <Input id="pp-city" value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={save} disabled={saving} className="w-full sm:w-auto">
                  {saving ? t("common.saving") : t("common.save")}
                </Button>
                <Button variant="outline" onClick={cancelPersonal} className="w-full sm:w-auto">
                  {t("common.cancel")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {referralUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" />
              {t("partner.profile.referralLink")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <code
              dir="ltr"
              className="block w-full select-all break-all rounded-md bg-muted px-3 py-2 text-xs font-mono"
            >
              {referralUrl}
            </code>
            <Button variant="outline" onClick={copyLink} className="w-full sm:w-auto gap-2">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? t("partner.profile.copied") : t("partner.profile.copy")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* A disabled referral code is surfaced explicitly so the partner can see
          why their link is missing instead of wondering where it went. */}
      {!referralUrl && profile?.referral_code && !referralEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              {t("partner.profile.referralLink")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              {t(
                "partner.profile.referralDisabled",
                "Your referral link is currently disabled. Please contact the Darb team to reactivate it."
              )}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            {t("partner.profile.changePassword")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!editingPassword ? (
            <>
              <p className="text-sm text-muted-foreground mb-3">
                {t("partner.profile.changePasswordPreview", "Set a new password for your account.")}
              </p>
              <Button variant="outline" className="gap-2" onClick={() => setEditingPassword(true)}>
                {t("partner.profile.changePasswordAction", "Change password")}
                <ChevronRight className="h-4 w-4 rtl:rotate-180" />
              </Button>
            </>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="pp-pw">{t("partner.profile.newPassword")}</Label>
                <Input
                  id="pp-pw"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  dir="ltr"
                />
                <p className="text-xs text-muted-foreground">{t("partner.profile.passwordHint")}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pp-pw2">{t("partner.profile.confirmPassword")}</Label>
                <Input
                  id="pp-pw2"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  dir="ltr"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={changePassword} disabled={changingPw} className="w-full sm:w-auto">
                  {changingPw ? t("common.saving") : t("partner.profile.updatePassword")}
                </Button>
                <Button variant="outline" onClick={cancelPassword} className="w-full sm:w-auto">
                  {t("common.cancel")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
