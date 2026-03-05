import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { User } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';
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
  const { t } = useTranslation();
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

  const redirectByRole = async (userId: string) => {
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
    navigate(path);
  };

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
  }, [navigate]);

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-4 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-blue-600/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-blue-500/8 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-blue-900/20 blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/30 backdrop-blur-sm mb-4 shadow-lg shadow-blue-500/10">
            <ShieldCheck className="h-8 w-8 text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">DARB</h1>
          <p className="text-blue-300/80 text-sm mt-1">{t('auth.loginSubtitle', 'Sign in to your account')}</p>
        </div>

        {/* Frosted glass card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl shadow-black/40 p-8">
          <h2 className="text-xl font-semibold text-white mb-6">{t('auth.loginTitle')}</h2>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-blue-200/90 text-sm font-medium">
                {t('auth.email')}
              </Label>
              <div className="relative">
                <Mail className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-400/60" />
                <Input
                  id="email"
                  type="email"
                  placeholder={t('auth.emailPlaceholder')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="ps-10 bg-white/8 border-white/15 text-white placeholder:text-white/30 focus:border-blue-400/60 focus:bg-white/10 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-blue-200/90 text-sm font-medium">
                  {t('auth.password')}
                </Label>
                <button
                  type="button"
                  onClick={() => setShowResetModal(true)}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {t('auth.forgotPassword')}
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-400/60" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('auth.passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="ps-10 pe-10 bg-white/8 border-white/15 text-white placeholder:text-white/30 focus:border-blue-400/60 focus:bg-white/10 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-blue-400/60 hover:text-blue-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-xl shadow-lg shadow-blue-600/25 transition-all hover:shadow-blue-500/35 hover:-translate-y-0.5 active:translate-y-0 mt-2"
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
        <p className="text-center text-white/30 text-xs mt-6">
          © {new Date().getFullYear()} DARB Study International
        </p>
      </div>

      <PasswordResetModal isOpen={showResetModal} onClose={() => setShowResetModal(false)} />

      <Dialog open={showChangePasswordModal} onOpenChange={() => {}}>
        <DialogContent className="max-w-sm bg-slate-900 border-white/10 text-white" onPointerDownOutside={e => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-white">يجب تغيير كلمة المرور</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-blue-200/70">تم إنشاء حسابك بكلمة مرور مؤقتة. يرجى تعيين كلمة مرور جديدة للمتابعة.</p>
          <div className="space-y-3">
            <div>
              <Label className="text-blue-200/90">كلمة المرور الجديدة</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="أدخل كلمة مرور جديدة"
                className="bg-white/8 border-white/15 text-white placeholder:text-white/30"
              />
              <PasswordStrength password={newPassword} />
            </div>
            <Button
              className="w-full bg-blue-600 hover:bg-blue-500"
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
