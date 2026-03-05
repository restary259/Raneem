import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { User } from '@supabase/supabase-js';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck, ArrowLeft } from 'lucide-react';
import PasswordResetModal from '@/components/auth/PasswordResetModal';
import PasswordStrength, { validatePassword } from '@/components/auth/PasswordStrength';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const ROLE_TO_PATH: Record<string, string> = {
  admin: '/admin',
  team_member: '/team',
  social_media_partner: '/partner',
  student: '/student/checklist',
};

const StudentAuthPage = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  // Stable ref so effect never re-runs due to navigate changing
  const navigateRef = useRef(navigate);
  useEffect(() => { navigateRef.current = navigate; }, [navigate]);

  const redirectByRole = useCallback(async (userId: string) => {
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('must_change_password')
      .eq('id', userId)
      .maybeSingle();

    if (profile?.must_change_password) {
      setShowChangePasswordModal(true);
      return;
    }

    const { data: role } = await supabase.rpc('get_my_role' as any);
    const path = (role && ROLE_TO_PATH[role as string]) || '/student/checklist';
    navigateRef.current(path);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user && isMounted) {
        setUser(session.user);
        await redirectByRole(session.user.id);
      }
    };
    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => {
          if (isMounted) redirectByRole(session.user.id);
        }, 0);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [redirectByRole]);

  const handleChangePassword = async () => {
    if (!validatePassword(newPassword)) {
      toast({ variant: 'destructive', title: 'كلمة مرور ضعيفة', description: 'يجب أن تحتوي على 10 أحرف على الأقل مع حرف كبير وصغير ورقم' });
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await (supabase as any).from('profiles').update({ must_change_password: false }).eq('id', session.user.id);
      }

      setShowChangePasswordModal(false);
      toast({ title: 'تم تغيير كلمة المرور بنجاح' });

      if (session) {
        await redirectByRole(session.user.id);
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: err.message });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth-guard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ email, password }),
      });

      const result = await resp.json();

      if (!resp.ok) {
        throw new Error(result.error || t('auth.loginFailed'));
      }

      if (result.session) {
        if (result.session_nonce) {
          localStorage.setItem('darb_session_nonce', result.session_nonce);
        }
        await supabase.auth.setSession({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token,
        });
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

      <Dialog open={showChangePasswordModal} onOpenChange={() => {}}>
        <DialogContent className="max-w-sm" onPointerDownOutside={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>يجب تغيير كلمة المرور</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">تم إنشاء حسابك بكلمة مرور مؤقتة. يرجى تعيين كلمة مرور جديدة للمتابعة.</p>
          <div className="space-y-3">
            <div>
              <Label>كلمة المرور الجديدة</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="أدخل كلمة مرور جديدة"
              />
              <PasswordStrength password={newPassword} />
            </div>
            <Button
              className="w-full"
              onClick={handleChangePassword}
              disabled={changingPassword || !newPassword}
            >
              {changingPassword ? <><Loader2 className="h-4 w-4 me-2 animate-spin" />جاري...</> : 'تغيير كلمة المرور'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentAuthPage;
