import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, Eye, EyeOff, MailCheck, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import PasswordStrength, { validatePassword } from "@/components/auth/PasswordStrength";
import { useAuth, ROLE_TO_PATH, type AppRole } from "@/contexts/AuthContext";

type PreviewState = "loading" | "valid" | "invalid" | "expired" | "accepted" | "revoked";

interface Preview {
  state: string;
  invitation_type: string | null;
  invited_email: string | null;
  masked_email: string | null;
  recruiter_name: string | null;
  case_reference: string | null;
}

/**
 * Invitation activation. The invitation itself lives in the database, so this
 * page works on any device, after any refresh, until it is accepted or expires.
 */
const ActivateAccountPage = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const { toast } = useToast();
  const { refreshRole } = useAuth();

  const [state, setState] = useState<PreviewState>("loading");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setState("invalid");
      return;
    }
    (async () => {
      const { data, error } = await supabase.rpc("get_invitation_preview", { p_token: token });
      if (cancelled) return;
      const row = (Array.isArray(data) ? data[0] : data) as Preview | undefined;
      if (error || !row) {
        setState("invalid");
        return;
      }
      setPreview(row);
      setEmail(row.invited_email ?? "");
      setState(
        row.state === "valid"
          ? "valid"
          : row.state === "expired"
            ? "expired"
            : row.state === "accepted"
              ? "accepted"
              : row.state === "revoked"
                ? "revoked"
                : "invalid",
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const errorFor = useCallback(
    (code?: string) => {
      switch (code) {
        case "email_mismatch":
          return t("activate.emailMismatch");
        case "expired":
          return t("activate.expired");
        case "accepted":
          return t("activate.accepted");
        case "revoked":
          return t("activate.revoked");
        case "weak_password":
          return t("activate.weakPassword");
        case "invalid":
          return t("activate.invalid");
        default:
          return null;
      }
    },
    [t],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePassword(password)) {
      toast({ variant: "destructive", title: t("activate.errorTitle"), description: t("activate.weakPassword") });
      return;
    }
    if (password !== confirm) {
      toast({ variant: "destructive", title: t("activate.errorTitle"), description: t("activate.mismatch") });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("accept-invitation", {
        body: { token, email: email.trim(), password },
      });

      // Non-2xx responses arrive as FunctionsHttpError with the body on context.
      let payload: Record<string, unknown> | null = (data as Record<string, unknown>) ?? null;
      if (error) {
        const res = (error as { context?: Response }).context;
        if (res && typeof res.json === "function") {
          try {
            payload = await res.json();
          } catch {
            payload = null;
          }
        }
        const mapped = errorFor(payload?.code as string | undefined);
        throw new Error(mapped ?? (payload?.error as string) ?? error.message);
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;

      // Route on the role this invitation was issued for — never on the global
      // top-priority role, which sends a dual-role user to the wrong dashboard.
      const invitedRole = (payload?.role as AppRole | undefined) ?? undefined;
      let role: AppRole | undefined = invitedRole;
      if (!role) {
        const { data: fallback } = await supabase.rpc("get_my_role");
        role = (fallback as AppRole) ?? "student";
      }
      await refreshRole();
      toast({ title: t("activate.success"), description: t("activate.successDesc") });
      navigate(ROLE_TO_PATH[role ?? "student"] ?? "/student/checklist", { replace: true });
    } catch (err) {
      toast({
        variant: "destructive",
        title: t("activate.errorTitle"),
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const shell = (children: React.ReactNode) => (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      className="min-h-screen flex items-center justify-center bg-gradient-to-b from-secondary via-background to-secondary p-4"
    >
      <div className="w-full max-w-lg rounded-3xl border border-border bg-card shadow-xl overflow-hidden">
        <div className="px-8 pt-8 pb-6 text-center border-b border-border bg-secondary/40">
          <img
            src="/lovable-uploads/d0f50c50-ec2b-4468-b0eb-5ba9efa39809.png"
            alt={t("loader.brand", "Darb")}
            className="h-12 w-auto object-contain mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-card-foreground">{t("activate.title")}</h1>
        </div>
        <div className="p-8">{children}</div>
      </div>
    </div>
  );

  if (state === "loading") {
    return shell(
      <div className="flex flex-col items-center gap-3 py-6">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{t("activate.checking")}</p>
      </div>,
    );
  }

  if (state !== "valid") {
    const message =
      state === "expired"
        ? t("activate.expired")
        : state === "accepted"
          ? t("activate.accepted")
          : state === "revoked"
            ? t("activate.revoked")
            : token
              ? t("activate.invalid")
              : t("activate.missingToken");
    return shell(
      <div className="space-y-5 text-center">
        <ShieldAlert className="h-10 w-10 text-destructive mx-auto" />
        <p className="text-sm text-foreground">{message}</p>
        <Button asChild className="w-full">
          <Link to="/student-auth">{t("activate.goToLogin")}</Link>
        </Button>
      </div>,
    );
  }

  return shell(
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center gap-2 rounded-xl bg-primary/10 px-4 py-3 text-primary">
        <MailCheck className="h-5 w-5 shrink-0" />
        <span className="text-sm font-semibold">{t("activate.invitedBadge")}</span>
      </div>

      <p className="text-sm text-muted-foreground">
        {preview?.invitation_type === "partner" ? t("activate.partnerIntro") : t("activate.studentIntro")}
      </p>

      {(preview?.recruiter_name || preview?.case_reference) && (
        <div className="rounded-xl border border-border bg-secondary/40 px-4 py-3 space-y-1 text-sm">
          {preview?.recruiter_name && (
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">{t("activate.recruiter")}</span>
              <span className="font-medium">{preview.recruiter_name}</span>
            </div>
          )}
          {preview?.case_reference && (
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">{t("activate.caseReference")}</span>
              <span className="font-medium" dir="ltr">{preview.case_reference}</span>
            </div>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="invited-email">{t("activate.email")}</Label>
        <Input
          id="invited-email"
          type="email"
          dir="ltr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="new-password">{t("activate.password")}</Label>
        <div className="relative">
          <Input
            id="new-password"
            type={showPw ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            className="pe-10"
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <PasswordStrength password={password} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirm-password">{t("activate.confirmPassword")}</Label>
        <Input
          id="confirm-password"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
        />
        {confirm && password !== confirm && (
          <p className="text-xs text-destructive">{t("activate.mismatch")}</p>
        )}
      </div>

      <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="me-2 h-4 w-4 animate-spin" />
            {t("activate.activating")}
          </>
        ) : (
          t("activate.submit")
        )}
      </Button>
    </form>,
  );
};

export default ActivateAccountPage;
