import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck, ArrowLeft } from 'lucide-react';
import PasswordResetModal from '@/components/auth/PasswordResetModal';
import PasswordStrength, { validatePassword } from '@/components/auth/PasswordStrength';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth, ROLE_TO_PATH } from '@/contexts/AuthContext';

const StudentAuthPage = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { initialized, user, role, mustChangePassword, refreshRole } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
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

    const path = ROLE_TO_PATH[role] ?? '/student/checklist';
    navigate(path, { replace: true });
  }, [initialized, user, role, mustChangePassword, navigate]);

  const handleChangePassword = async () => {
    if (!validatePassword(newPassword)) {
      toast({ variant: 'destructive', title: 'كلمة مرور ضعيفة', description: 'يجب أن تحتوي على 10 أحرف على الأقل مع حرف كبير وصغير ورقم' });
      return;
    }
    setChangingPassword(true);
    try {
      // Ensure session is fresh before updating password
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('انتهت جلستك. يرجى تسجيل الدخول مجدداً.');
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      await supabase
        .from('profiles')
        .update({ must_change_password: false })
        .eq('id', sessionData.session.user.id);

      setShowChangePasswordModal(false);
      toast({ title: 'تم تغيير كلمة المرور بنجاح' });
      await refreshRole();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: err.message });
      // If session expired, close modal so user can log in again
      if (err.message.includes('انتهت جلستك') || err.message.includes('session')) {
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

      toast({ title: t('auth.loginSuccess'), description: t('auth.loginSuccessDesc') });
    } catch (error: any) {
      let errorMessage = error.message;
      if (error.message.includes('Invalid login credentials')) {
        errorMessage = t('auth.invalidCredentials');
      } else if (error.message.includes('Invalid email')) {
        errorMessage = t('auth.invalidEmail');
      }
      toast({ variant: 'destructive', title: t('auth.errorTitle'), description: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-primary/5 to-background p-4 relative overflow-hidden">
      {/* Background decorative glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Back to website */}
        <div className="mb-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors group"
          >
            <ArrowLeft className={`h-4 w-4 transition-transform group-hover:-translate-x-1 ${isRTL ? 'rotate-180' : ''}`} />
            {t('auth.backToWebsite', 'Back to main website')}
          </Link>
        </div>

        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/15 border border-primary/25 backdrop-blur-sm mb-4 shadow-lg">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">DARB</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('auth.loginSubtitle', 'Sign in to your account')}</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-card-foreground mb-6">{t('auth.loginTitle')}</h2>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-foreground/90 text-sm font-medium">
                {t('auth.email')}
              </Label>
              <div className="relative">
                <Mail className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="email"
                  type="email"
                  placeholder={t('auth.emailPlaceholder')}
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
                  {t('auth.password')}
                </Label>
                <button
                  type="button"
                  onClick={() => setShowResetModal(true)}
                  className="text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  {t('auth.forgotPassword')}
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('auth.passwordPlaceholder')}
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
              className="w-full font-semibold py-2.5 rounded-xl shadow-lg transition-all hover:-translate-y-0.5 active:translate-y-0 mt-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                  {t('auth.loading')}
                </>
              ) : t('auth.loginButton')}
            </Button>
          </form>
        </div>

        {/* Footer note */}
        <p className="text-center text-muted-foreground/50 text-xs mt-6">
          © {new Date().getFullYear()} DARB Study International
        </p>
      </div>

      <PasswordResetModal isOpen={showResetModal} onClose={() => setShowResetModal(false)} />

      <Dialog open={showChangePasswordModal} onOpenChange={async (open) => {
        if (!open) {
          await supabase.auth.signOut();
          setShowChangePasswordModal(false);
        }
      }}>
        <DialogContent className="max-w-sm" onPointerDownOutside={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{isRTL ? 'يجب تغيير كلمة المرور' : 'Password Change Required'}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {isRTL
              ? 'تم إنشاء حسابك بكلمة مرور مؤقتة. يرجى تعيين كلمة مرور جديدة للمتابعة.'
              : 'Your account was created with a temporary password. Please set a new password to continue.'}
          </p>
          <div className="space-y-3">
            <div>
              <Label>{isRTL ? 'كلمة المرور الجديدة' : 'New Password'}</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder={isRTL ? 'أدخل كلمة مرور جديدة' : 'Enter new password'}
              />
              <PasswordStrength password={newPassword} />
            </div>
            <Button
              className="w-full"
              onClick={handleChangePassword}
              disabled={changingPassword || !newPassword}
            >
              {changingPassword
                ? <><Loader2 className="h-4 w-4 me-2 animate-spin" />{isRTL ? 'جاري...' : 'Saving...'}</>
                : isRTL ? 'تغيير كلمة المرور' : 'Change Password'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentAuthPage;
