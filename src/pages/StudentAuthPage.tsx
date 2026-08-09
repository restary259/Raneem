import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck, ArrowLeft } from "lucide-react";
import PasswordResetModal from "@/components/auth/PasswordResetModal";
import PasswordStrength, { validatePassword } from "@/components/auth/PasswordStrength";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth, ROLE_TO_PATH } from "@/contexts/AuthContext";

const StudentAuthPage = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const { initialized, user, role, mustChangePassword, refreshRole } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Single redirect effect — AuthContext owns all auth state
  useEffect(() => {
    if (!initialized) return;
    if (!user) return;

    if (mustChangePassword) {
      setShowChangePasswordModal(true);
      return;
    }

    if (!role) {
      // Signed in but no role assigned — never leave the user stuck on the login screen
      toast({
        variant: "destructive",
        title: t("auth.errorTitle"),
        description: isRTL
          ? "تم تسجيل الدخول لكن لا توجد صلاحية مرتبطة بحسابك. يرجى التواصل مع الإدارة."
          : "Signed in, but no role is assigned to your account. Please contact the administrator.",
      });
      supabase.auth.signOut();
      return;
    }

    const path = ROLE_TO_PATH[role] ?? "/student/checklist";
    navigate(path, { replace: true });
  }, [initialized, user, role, mustChangePassword, navigate]);

  // Mobile-only: lock body scroll so the login screen stays a single static viewport.
  // Applied only on mount and cleaned up on unmount; scoped strictly to this component.
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    const applyLock = () => {
      if (mql.matches) {
        document.body.style.overflow = "hidden";
        document.body.style.height = "100dvh";
      }
    };
    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        document.body.style.overflow = "hidden";
        document.body.style.height = "100dvh";
      } else {
        document.body.style.overflow = "";
        document.body.style.height = "";
      }
    };

    applyLock();
    mql.addEventListener("change", handleChange);
    return () => {
      mql.removeEventListener("change", handleChange);
      document.body.style.overflow = "";
      document.body.style.height = "";
    };
  }, []);

  const handleChangePassword = async () => {
    if (!validatePassword(newPassword)) {
      toast({
        variant: "destructive",
        title: "كلمة مرور ضعيفة",
        description: "يجب أن تحتوي على 10 أحرف على الأقل مع حرف كبير وصغير ورقم",
      });
      return;
    }
    setChangingPassword(true);
    try {
      // Ensure session is fresh before updating password
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error("انتهت جلستك. يرجى تسجيل الدخول مجدداً.");
      }

      // Change the password first, then clear the temporary-password flag through the
      // security-definer RPC (a direct profiles update is blocked by restrict_profiles_write).
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      // A retry after an already-successful change reports "same password" — that is not a
      // failure here, the flag below still needs clearing.
      if (error && !/same[_ ]password|different from the old/i.test(error.message)) throw error;

      const { error: flagError } = await (supabase as any).rpc("clear_must_change_password");
      if (flagError) throw flagError;

      await refreshRole();
      setShowChangePasswordModal(false);
      toast({ title: "تم تغيير كلمة المرور بنجاح" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "خطأ", description: err.message });
      // If session expired, close modal so user can log in again
      if (err.message.includes("انتهت جلستك") || err.message.includes("session")) {
        setShowChangePasswordModal(false);
        await supabase.auth.signOut();
      }
    } finally {
      setChangingPassword(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Use signInWithPassword directly — this sets the session atomically in the Supabase client,
      // preventing the "auth session missing" race condition that occurs when using setSession()
      // after a fetch-based auth-guard response.
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        throw new Error(error.message);
      }

      if (data.session) {
        // Session is now live in the client — refreshRole will read it correctly
        await refreshRole();
      }

      toast({ title: t("auth.loginSuccess"), description: t("auth.loginSuccessDesc") });
    } catch (error: any) {
      let errorMessage = error.message;
      if (error.message.includes("Invalid login credentials")) {
        errorMessage = t("auth.invalidCredentials");
      } else if (error.message.includes("Invalid email")) {
        errorMessage = t("auth.invalidEmail");
      }
      toast({ variant: "destructive", title: t("auth.errorTitle"), description: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      dir={isRTL ? "rtl" : "ltr"}
      className="flex items-center justify-center bg-gradient-to-b from-secondary via-background to-secondary relative overflow-hidden h-[100dvh] md:h-auto md:min-h-screen p-3 md:p-4"
    >
      {/* Background decorative glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -end-40 w-[28rem] h-[28rem] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-48 -start-40 w-[28rem] h-[28rem] rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="w-full max-w-lg relative z-10">
        {/* Back to website */}
        <div className="mb-3 md:mb-5">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors group"
          >
            <ArrowLeft
              className={`h-4 w-4 transition-transform group-hover:-translate-x-1 ${isRTL ? "rotate-180 group-hover:translate-x-1" : ""}`}
            />
            {t("auth.backToWebsite", "Back to main website")}
          </Link>
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-border bg-card shadow-xl overflow-hidden">
          {/* Brand header */}
          <div className="px-5 pt-5 pb-4 md:px-8 md:pt-8 md:pb-6 text-center border-b border-border bg-secondary/40">
            <img
              src="/lovable-uploads/d0f50c50-ec2b-4468-b0eb-5ba9efa39809.png"
              alt={t("loader.brand", "Darb")}
              className="h-9 md:h-12 w-auto object-contain mx-auto mb-3 md:mb-4"
            />
            <h1 className="text-xl md:text-2xl font-bold text-card-foreground">{t("auth.loginTitle")}</h1>
            <p className="mt-1 md:mt-1.5 text-sm text-muted-foreground">
              {isRTL
                ? "سجّل الدخول لمتابعة ملفك ومستنداتك وحالة طلبك"
                : "Sign in to follow your profile, documents and application status"}
            </p>
          </div>

          <div className="p-5 pt-5 md:p-8 md:pt-7">



          <form onSubmit={handleLogin} className="space-y-4 md:space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-foreground/90 text-sm font-medium">
                {t("auth.email")}
              </Label>
              <div className="relative">
                <Mail className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="email"
                  type="email"
                  placeholder={t("auth.emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="ps-10 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-foreground/90 text-sm font-medium">
                  {t("auth.password")}
                </Label>
                <button
                  type="button"
                  onClick={() => setShowResetModal(true)}
                  className="text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  {t("auth.forgotPassword")}
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={t("auth.passwordPlaceholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="ps-10 pe-10 transition-all"
                />
                <button
                  type="button"
                  aria-label={showPassword ? (isRTL ? "إخفاء كلمة المرور" : "Hide password") : (isRTL ? "إظهار كلمة المرور" : "Show password")}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 md:h-12 text-base font-semibold rounded-xl shadow-md transition-all hover:-translate-y-0.5 active:translate-y-0 mt-1 md:mt-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  {t("auth.loading")}
                </>
              ) : (
                t("auth.loginButton")
              )}
            </Button>
          </form>
          </div>
        </div>

      </div>

      <PasswordResetModal isOpen={showResetModal} onClose={() => setShowResetModal(false)} />

      <Dialog
        open={showChangePasswordModal}
        onOpenChange={async (open) => {
          if (!open) {
            await supabase.auth.signOut();
            setShowChangePasswordModal(false);
          }
        }}
      >
        <DialogContent className="max-w-sm" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{isRTL ? "يجب تغيير كلمة المرور" : "Password Change Required"}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {isRTL
              ? "تم إنشاء حسابك بكلمة مرور مؤقتة. يرجى تعيين كلمة مرور جديدة للمتابعة."
              : "Your account was created with a temporary password. Please set a new password to continue."}
          </p>
          <div className="space-y-3">
            <div>
              <Label>{isRTL ? "كلمة المرور الجديدة" : "New Password"}</Label>
              <div className="relative">
                <Input
                  type={showNewPw ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={isRTL ? "أدخل كلمة مرور جديدة" : "Enter new password"}
                  className="pe-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw((v) => !v)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <PasswordStrength password={newPassword} />
            </div>
            <Button className="w-full" onClick={handleChangePassword} disabled={changingPassword || !newPassword}>
              {changingPassword ? (
                <>
                  <Loader2 className="h-4 w-4 me-2 animate-spin" />
                  {isRTL ? "جاري..." : "Saving..."}
                </>
              ) : isRTL ? (
                "تغيير كلمة المرور"
              ) : (
                "Change Password"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentAuthPage;
