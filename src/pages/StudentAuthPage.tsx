
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { User } from '@supabase/supabase-js';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import PasswordResetModal from '@/components/auth/PasswordResetModal';
import AuthDebugPanel from '@/components/auth/AuthDebugPanel';
import PasswordStrength, { validatePassword } from '@/components/auth/PasswordStrength';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const StudentAuthPage = () => {
  const { t } = useTranslation();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [country, setCountry] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const refId = searchParams.get('ref');

  const redirectByRole = async (userId: string) => {
    // Check must_change_password first
    const { data: profile } = await (supabase as any).from('profiles').select('must_change_password').eq('id', userId).maybeSingle();
    if (profile?.must_change_password) {
      setShowChangePasswordModal(true);
      return;
    }

    const { data: roles } = await (supabase as any)
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    
    if (roles?.some((r: any) => r.role === 'admin')) {
      navigate('/admin');
    } else if (roles?.some((r: any) => r.role === 'lawyer')) {
      navigate('/lawyer-dashboard');
    } else if (roles?.some((r: any) => r.role === 'influencer')) {
      navigate('/influencer-dashboard');
    } else {
      navigate('/student-dashboard');
    }
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

      // Update must_change_password
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await (supabase as any).from('profiles').update({ must_change_password: false }).eq('id', session.user.id);
      }

      setShowChangePasswordModal(false);
      toast({ title: 'تم تغيير كلمة المرور بنجاح' });

      // Now redirect
      if (session) {
        await redirectByRole(session.user.id);
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: err.message });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isLogin) {
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
          await supabase.auth.setSession({
            access_token: result.session.access_token,
            refresh_token: result.session.refresh_token,
          });
        }

        toast({
          title: t('auth.loginSuccess'),
          description: t('auth.loginSuccessDesc'),
        });
      } else {
        if (!validatePassword(password)) {
          toast({
            variant: "destructive",
            title: t('auth.weakPassword'),
            description: t('auth.weakPasswordDesc'),
          });
          setIsLoading(false);
          return;
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              phone_number: phoneNumber,
              country: country,
              ...(refId ? { influencer_id: refId } : {}),
            },
            emailRedirectTo: `${window.location.origin}/student-dashboard`
          }
        });

        if (error) throw error;

        toast({
          title: t('auth.signupSuccess'),
          description: t('auth.signupSuccessDesc'),
        });
      }
    } catch (error: any) {
      let errorMessage = error.message;
      if (error.message.includes('Invalid login credentials')) {
        errorMessage = t('auth.invalidCredentials');
      } else if (error.message.includes('User already registered')) {
        errorMessage = t('auth.alreadyRegistered');
      } else if (error.message.includes('Invalid email')) {
        errorMessage = t('auth.invalidEmail');
      }

      toast({
        variant: "destructive",
        title: t('auth.errorTitle'),
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">
              {isLogin ? t('auth.loginTitle') : t('auth.signupTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAuth} className="space-y-4">
              {!isLogin && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="fullName">{t('auth.fullName')}</Label>
                    <Input id="fullName" placeholder={t('auth.fullNamePlaceholder')} value={fullName} onChange={(e) => setFullName(e.target.value)} required={!isLogin} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber">{t('auth.phone')}</Label>
                    <Input id="phoneNumber" type="tel" placeholder={t('auth.phonePlaceholder')} value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">{t('auth.country')}</Label>
                    <Input id="country" placeholder={t('auth.countryPlaceholder')} value={country} onChange={(e) => setCountry(e.target.value)} />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">{t('auth.email')}</Label>
                <Input id="email" type="email" placeholder={t('auth.emailPlaceholder')} value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t('auth.password')}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={t('auth.passwordPlaceholder')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={10}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute end-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {!isLogin && <PasswordStrength password={password} />}
                {isLogin && (
                  <div className="text-left">
                    <Button type="button" variant="link" size="sm" onClick={() => setShowResetModal(true)} className="p-0 h-auto font-normal text-sm text-primary hover:underline">
                      {t('auth.forgotPassword')}
                    </Button>
                  </div>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    {t('auth.loading')}
                  </>
                ) : (
                  isLogin ? t('auth.loginButton') : t('auth.signupButton')
                )}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <Button variant="link" onClick={() => setIsLogin(!isLogin)} className="text-sm">
                {isLogin ? t('auth.noAccount') : t('auth.hasAccount')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {import.meta.env.DEV && <AuthDebugPanel />}
        <PasswordResetModal isOpen={showResetModal} onClose={() => setShowResetModal(false)} />

        {/* Forced Password Change Modal */}
        <Dialog open={showChangePasswordModal} onOpenChange={() => {}}>
          <DialogContent className="max-w-sm" onPointerDownOutside={e => e.preventDefault()}>
            <DialogHeader><DialogTitle>يجب تغيير كلمة المرور</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">تم إنشاء حسابك بكلمة مرور مؤقتة. يرجى تعيين كلمة مرور جديدة للمتابعة.</p>
            <div className="space-y-3">
              <div>
                <Label>كلمة المرور الجديدة</Label>
                <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="أدخل كلمة مرور جديدة" />
                <PasswordStrength password={newPassword} />
              </div>
              <Button className="w-full" onClick={handleChangePassword} disabled={changingPassword || !newPassword}>
                {changingPassword ? <><Loader2 className="h-4 w-4 me-2 animate-spin" />جاري...</> : 'تغيير كلمة المرور'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default StudentAuthPage;
