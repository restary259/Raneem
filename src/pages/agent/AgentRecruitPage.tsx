import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuthedUserId } from "@/hooks/useAuthedUserId";
import { useDirection } from "@/hooks/useDirection";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, Send, Loader2, Mail, KeyRound, CheckCircle2, Link2, Copy, Check, Users, Megaphone } from "lucide-react";
import DashboardLoading from "@/components/dashboard/DashboardLoading";
import { identityConflictMessage } from "@/lib/identityConflict";
import { readFunctionError, readFunctionErrorBody } from "@/lib/functionError";
import { getRoleLabel } from "@/lib/roleLabels";

type RecruitRole = "social_media_partner" | "ambassador";
type DeliveryMode = "invite" | "manual";

const fmt = (n: number) => `₪${Number(n || 0).toLocaleString("en-US")}`;

/**
 * Dedicated recruitment area. The agent registers a new partner or ambassador
 * and chooses how the account is delivered:
 *  - Invite: sends a branded DARB activation email (the recruit sets their
 *    own password on /activate). The invitation is durable and agent-attributed.
 *  - Manual: (when enabled) the agent creates the account directly and a
 *    temp password is returned. Falls back to invite if the permission is off.
 *
 * Both paths prevent duplicate accounts server-side (identityConflict +
 * InvitationConflictError in agent-invite-recruit / createInvitation).
 */
export default function AgentRecruitPage() {
  const { t } = useTranslation("dashboard");
  const { dir } = useDirection();
  const { toast } = useToast();

  const [role, setRole] = useState<RecruitRole>("social_media_partner");
  const [mode, setMode] = useState<DeliveryMode>("invite");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ email: string; role: RecruitRole; mode: DeliveryMode; tempPassword?: string } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [canInvite, setCanInvite] = useState(false);
  const [canCreateManual, setCanCreateManual] = useState(false);
  const [partnerRecruitCode, setPartnerRecruitCode] = useState<string | null>(null);
  const [ambassadorRecruitCode, setAmbassadorRecruitCode] = useState<string | null>(null);
  const [copiedPartner, setCopiedPartner] = useState(false);
  const [copiedAmbassador, setCopiedAmbassador] = useState(false);
  const [loading, setLoading] = useState(true);
  const [perRecruitRate, setPerRecruitRate] = useState(0);

  const load = useCallback(async (uid: string) => {
    const [profRes, linkRes, overrideRes, settingsRes] = await Promise.all([
      (supabase as any)
        .from("profiles")
        .select("agent_can_invite_directly, agent_can_create_accounts")
        .eq("id", uid)
        .maybeSingle(),
      (supabase as any).rpc("ensure_agent_recruit_link"),
      (supabase as any)
        .from("agent_commission_overrides")
        .select("commission_amount")
        .eq("agent_id", uid)
        .maybeSingle(),
      (supabase as any)
        .from("platform_settings")
        .select("agent_commission_rate")
        .limit(1)
        .maybeSingle(),
    ]);
    setCanInvite(profRes.data?.agent_can_invite_directly ?? false);
    setCanCreateManual(profRes.data?.agent_can_create_accounts ?? false);
    const linkRows = Array.isArray(linkRes.data) ? linkRes.data : linkRes.data ? [linkRes.data] : [];
    const partnerLink = linkRows.find((r: { target_role?: string | null }) => !r.target_role || r.target_role === "social_media_partner");
    const ambassadorLink = linkRows.find((r: { target_role?: string | null }) => r.target_role === "ambassador");
    setPartnerRecruitCode(partnerLink?.code ?? linkRows[0]?.code ?? null);
    setAmbassadorRecruitCode(ambassadorLink?.code ?? null);
    const global = Number(settingsRes.data?.agent_commission_rate ?? 0);
    setPerRecruitRate(Number(overrideRes.data?.commission_amount ?? global));
    setLoading(false);
  }, []);

  const userId = useAuthedUserId(load);

  if (!userId || loading) return <DashboardLoading />;

  const emailTrimmed = email.trim().toLowerCase();
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed);
  const formValid = fullName.trim().length > 0 && emailValid;

  // If manual isn't permitted, force invite mode.
  const effectiveMode: DeliveryMode = mode === "manual" && !canCreateManual ? "invite" : mode;
  const partnerRecruitUrl = partnerRecruitCode ? `${window.location.origin}/join/${partnerRecruitCode}` : "";
  const ambassadorRecruitUrl = ambassadorRecruitCode ? `${window.location.origin}/join/${ambassadorRecruitCode}` : "";

  const copyPartnerLink = async () => {
    if (!partnerRecruitUrl) return;
    try {
      await navigator.clipboard.writeText(partnerRecruitUrl);
      setCopiedPartner(true);
      setTimeout(() => setCopiedPartner(false), 1500);
    } catch { /* clipboard may be unavailable */ }
  };

  const copyAmbassadorLink = async () => {
    if (!ambassadorRecruitUrl) return;
    try {
      await navigator.clipboard.writeText(ambassadorRecruitUrl);
      setCopiedAmbassador(true);
      setTimeout(() => setCopiedAmbassador(false), 1500);
    } catch { /* clipboard may be unavailable */ }
  };

  const submit = async () => {
    if (!formValid || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (effectiveMode === "manual" && canCreateManual) {
        // Manual account creation via the agent-create-account edge function.
        const { data, error } = await supabase.functions.invoke("agent-create-account", {
          body: {
            email: emailTrimmed,
            full_name: fullName.trim(),
            phone: phone.trim() || undefined,
            city: city.trim() || undefined,
            role,
          },
        });
        if (error) {
          const body = await readFunctionErrorBody(error);
          const conflict = identityConflictMessage(body as any, t);
          if (conflict) throw new Error(conflict);
          throw new Error(await readFunctionError(error));
        }
        setSuccess({ email: emailTrimmed, role, mode: "manual", tempPassword: data?.temp_password });
      } else {
        // Invite: durable invitation + branded DARB email.
        const { error } = await supabase.functions.invoke("agent-invite-recruit", {
          body: { email: emailTrimmed, full_name: fullName.trim(), role },
        });
        if (error) {
          const body = await readFunctionErrorBody(error);
          const conflict = identityConflictMessage(body as any, t);
          if (conflict) throw new Error(conflict);
          throw new Error(await readFunctionError(error));
        }
        setSuccess({ email: emailTrimmed, role, mode: "invite" });
      }
      setFullName("");
      setEmail("");
      setPhone("");
      setCity("");
    } catch (err: any) {
      const message = err?.message ?? t("common.actionFailed", "Something went wrong. Please try again or contact support.");
      setSubmitError(message);
      toast({ variant: "destructive", description: message });
    } finally {
      setSubmitting(false);
    }
  };

  const resetSuccess = () => setSuccess(null);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6" dir={dir}>
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <UserPlus className="h-6 w-6 text-primary" />
          {t("agent.recruitTitle", "Recruit")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("agent.recruitSubtitle", "Register a new partner or ambassador and invite them to your network.")}
        </p>
      </div>

      {/* Success state */}
      {success ? (
        <Card className="border-emerald-200 dark:border-emerald-500/30">
          <CardContent className="p-6 text-center space-y-3">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-bold">{t("agent.recruitSuccess", "Recruitment initiated")}</h2>
            <p className="text-sm text-muted-foreground">
              {success.mode === "invite"
                ? t("agent.recruitSuccessInvite", { email: success.email })
                : t("agent.recruitSuccessManual", { email: success.email })}
            </p>
            {success.tempPassword && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 max-w-sm mx-auto">
                <p className="text-xs text-muted-foreground mb-1">{t("agent.tempPassword", "Temporary password")}</p>
                <p className="font-mono text-sm font-bold" dir="ltr">{success.tempPassword}</p>
                <p className="text-xs text-amber-600 mt-2">{t("agent.tempPasswordWarn", "Share this securely. The recruit will be asked to change it on first login.")}</p>
              </div>
            )}
            <Button onClick={resetSuccess} variant="outline" className="mt-2">
              {t("agent.recruitAnother", "Recruit another")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Combined wizard card — role, delivery + commission, details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-primary" />
                {t("agent.recruitWizardTitle", "Recruit a partner or ambassador")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Step 1 — role */}
              <div className="space-y-3">
                <StepHeader step={1} label={t("agent.recruitStep1", "Who are you recruiting?")} />
                <div className="grid grid-cols-2 gap-3">
                  <RoleCard
                    active={role === "social_media_partner"}
                    onClick={() => setRole("social_media_partner")}
                    icon={Users}
                    title={getRoleLabel("social_media_partner")}
                    desc={t("agent.rolePartnerDesc", "Lawyer / agency partner")}
                  />
                  <RoleCard
                    active={role === "ambassador"}
                    onClick={() => setRole("ambassador")}
                    icon={Megaphone}
                    title={getRoleLabel("ambassador")}
                    desc={t("agent.roleAmbassadorDesc", "Influencer / referrer")}
                  />
                </div>
              </div>

              <div className="border-t border-border" />

              {/* Step 2 — delivery mode + per-recruit commission */}
              <div className="space-y-3">
                <StepHeader step={2} label={t("agent.recruitStep2", "How should they receive their account?")} />
                <DeliveryCard
                  active={effectiveMode === "invite"}
                  onClick={() => setMode("invite")}
                  icon={Mail}
                  title={t("agent.deliveryInvite", "Send Gmail invite")}
                  desc={t("agent.deliveryInviteDesc", "The recruit receives a branded DARB email with an activation link and sets their own password.")}
                  disabled={!canInvite}
                  disabledHint={t("agent.deliveryInviteDisabled", "Direct invites are not enabled for your account.")}
                />
                <DeliveryCard
                  active={effectiveMode === "manual" && canCreateManual}
                  onClick={() => setMode("manual")}
                  icon={KeyRound}
                  title={t("agent.deliveryManual", "Create account manually")}
                  desc={t("agent.deliveryManualDesc", "Create the account now and receive a temporary password to share with the recruit.")}
                  disabled={!canCreateManual}
                  disabledHint={t("agent.deliveryManualDisabled", "Manual account creation is not enabled for your account.")}
                />
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground">
                      {t("agent.perRecruitRate", "Per-recruit rate")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("agent.perRecruitRateHint", "Earned when a student brought by this recruit pays.")}
                    </p>
                  </div>
                  <span className="font-mono text-sm font-bold text-emerald-600 whitespace-nowrap">{fmt(perRecruitRate)}</span>
                </div>
              </div>

              <div className="border-t border-border" />

              {/* Step 3 — recruit details */}
              <div className="space-y-4">
                <StepHeader step={3} label={t("agent.recruitStep3", "Recruit details")} />
                <div className="space-y-1.5">
                  <Label>{t("agent.inviteFullName", "Full name")}</Label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={t("agent.inviteFullNamePlaceholder", "e.g. Sara Khalil")}
                    maxLength={100}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("agent.inviteEmail", "Email")}</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    dir="ltr"
                    maxLength={255}
                    className={email && !emailValid ? "border-destructive focus-visible:ring-destructive" : undefined}
                    aria-invalid={!!email && !emailValid}
                  />
                  {email && !emailValid && (
                    <p className="text-xs text-destructive">{t("agent.inviteEmailInvalid", "Enter a valid email address")}</p>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>{t("partner.profile.phone", "Phone")}</Label>
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" placeholder="0501234567" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("partner.profile.city", "City")}</Label>
                    <Input value={city} onChange={(e) => setCity(e.target.value)} />
                  </div>
                </div>
                {submitError && (
                  <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                    {submitError}
                  </p>
                )}
                <Button onClick={submit} disabled={submitting || !formValid} className="w-full sm:w-auto gap-2">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> :
                    effectiveMode === "invite" ? <Send className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
                  {submitting
                    ? t("common.saving", "Saving...")
                    : effectiveMode === "invite"
                      ? t("agent.sendInvite", "Send invitation")
                      : t("agent.createAccount", "Create account")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Recruit link fallback */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" />
            {t("agent.recruitLinks", "Recruiting links")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            {t("agent.recruitLinksHint", "Share these links to recruit partners or ambassadors. Applications through them are attached to your network after Darb approves them.")}
          </p>

          {/* Partner link */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-foreground">
              {t("agent.recruitPartnerLink", "Partner recruiting link")}
            </p>
            {partnerRecruitUrl ? (
              <div className="flex gap-2">
                <input
                  readOnly
                  value={partnerRecruitUrl}
                  dir="ltr"
                  className="flex-1 min-w-0 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs font-mono text-muted-foreground"
                />
                <Button variant="outline" size="icon" onClick={copyPartnerLink} aria-label={t("common.copy", "Copy")}>
                  {copiedPartner ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t("agent.inviteMissing", "No recruiting link yet.")}</p>
            )}
          </div>

          {/* Ambassador link */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-foreground">
              {t("agent.recruitAmbassadorLink", "Ambassador recruiting link")}
            </p>
            {ambassadorRecruitUrl ? (
              <div className="flex gap-2">
                <input
                  readOnly
                  value={ambassadorRecruitUrl}
                  dir="ltr"
                  className="flex-1 min-w-0 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs font-mono text-muted-foreground"
                />
                <Button variant="outline" size="icon" onClick={copyAmbassadorLink} aria-label={t("common.copy", "Copy")}>
                  {copiedAmbassador ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t("agent.ambassadorLinkMissing", "No ambassador link yet.")}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StepHeader({ step, label }: { step: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold">
        {step}
      </span>
      <h3 className="text-sm font-semibold text-foreground">{label}</h3>
    </div>
  );
}

function RoleCard({
  active,
  onClick,
  icon: Icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start gap-2 rounded-xl border p-4 text-start transition-all ${
        active ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:border-primary/40"
      }`}
    >
      <div className={`inline-flex items-center justify-center w-9 h-9 rounded-xl ${active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </button>
  );
}

function DeliveryCard({
  active,
  onClick,
  icon: Icon,
  title,
  desc,
  disabled,
  disabledHint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  disabled?: boolean;
  disabledHint?: string;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`flex items-start gap-3 rounded-xl border p-4 text-start transition-all w-full ${
        disabled ? "border-border opacity-60 cursor-not-allowed" :
        active ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:border-primary/40"
      }`}
    >
      <div className={`inline-flex items-center justify-center w-9 h-9 rounded-xl shrink-0 ${active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
        {disabled && disabledHint && (
          <Badge variant="secondary" className="mt-2 text-xs">{disabledHint}</Badge>
        )}
      </div>
    </button>
  );
}
