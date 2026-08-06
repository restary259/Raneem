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
    if (!user || !role) return;

    if (mustChangePassword) {
      setShowChangePasswordModal(true);
      return;
    }

    const path = ROLE_TO_PATH[role] ?? "/student/checklist";
    navigate(path, { replace: true });
  }, [initialized, user, role, mustChangePassword, navigate]);

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

      // Update profile FIRST so that when updateUser fires the USER_UPDATED event,
      // AuthContext re-reads must_change_password as false — preventing a race where
      // the modal would re-open before refreshRole() corrects the state.
      await supabase.from("profiles").update({ must_change_password: false }).eq("id", sessionData.session.user.id);

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        // Roll back the profile flag if the password update itself fails
        await supabase.from("profiles").update({ must_change_password: true }).eq("id", sessionData.session.user.id);
        throw error;
      }

      setShowChangePasswordModal(false);
      toast({ title: "تم تغيير كلمة المرور بنجاح" });
      await refreshRole();
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
      className="min-h-screen flex items-center justify-center bg-gradient-to-b from-secondary via-background to-secondary p-4 relative overflow-hidden"
    >
      {/* Background decorative glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -end-40 w-[28rem] h-[28rem] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-48 -start-40 w-[28rem] h-[28rem] rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="w-full max-w-lg relative z-10">
        {/* Back to website */}
        <div className="mb-5">
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
          <div className="px-8 pt-8 pb-6 text-center border-b border-border bg-secondary/40">
            <img
              src="/lovable-uploads/d0f50c50-ec2b-4468-b0eb-5ba9efa39809.png"
              alt={t("loader.brand", "Darb")}
              className="h-12 w-auto object-contain mx-auto mb-4"
            />
            <h1 className="text-2xl font-bold text-card-foreground">{t("auth.loginTitle")}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {isRTL
                ? "سجّل الدخول لمتابعة ملفك ومستنداتك وحالة طلبك"
                : "Sign in to follow your profile, documents and application status"}
            </p>
          </div>

          <div className="p-8 pt-7">



          <form onSubmit={handleLogin} className="space-y-5">
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
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold rounded-xl shadow-md transition-all hover:-translate-y-0.5 active:translate-y-0 mt-2"
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
