
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { User } from '@supabase/supabase-js';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import PasswordResetModal from '@/components/auth/PasswordResetModal';
import { Checkbox } from '@/components/ui/checkbox';
import AuthDebugPanel from '@/components/auth/AuthDebugPanel';
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
  const [searchParams] = useSearchParams();

  const redirectByRole = async (userId: string) => {
    // Check must_change_password first
    const { data: profile } = await (supabase as any).from('profiles').select('must_change_password').eq('id', userId).maybeSingle();
    if (profile?.must_change_password) {
      setShowChangePasswordModal(true);
      return;
    }

    // Use get_my_role() RPC — secure, no direct user_roles query
    const { data: role } = await supabase.rpc('get_my_role' as any);
    const path = role ? ROLE_TO_PATH[role as string] : '/student/checklist';
    navigate(path || '/student/checklist');
  };

  const handleGoogleSignIn = async () => {
    try {
      const { error } = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: window.location.origin,
      });
      if (error) throw error;
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('auth.errorTitle'), description: err.message });
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
          // Store session nonce for single-session enforcement
          if (result.session_nonce) {
            localStorage.setItem('darb_session_nonce', result.session_nonce);
          }
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

        if (!consentAccepted) {
          toast({
            variant: "destructive",
            title: t('auth.consentRequired', 'Consent Required'),
            description: t('auth.consentRequiredDesc', 'You must accept the terms and privacy policy to register.'),
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
                    minLength={isLogin ? 1 : 10}
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

              {!isLogin && (
                <div className="flex items-start gap-2 mt-2">
                  <Checkbox
                    id="consent"
                    checked={consentAccepted}
                    onCheckedChange={(checked) => setConsentAccepted(checked === true)}
                  />
                  <Label htmlFor="consent" className="text-xs leading-tight cursor-pointer">
                    {t('auth.consentText', 'I agree to the Terms of Service and Privacy Policy. My data will be processed to provide educational consulting services.')}
                  </Label>
                </div>
              )}

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

            {/* Google OAuth divider */}
            <div className="my-4 flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">{t('auth.orContinueWith', 'or continue with')}</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full flex items-center gap-2"
              onClick={handleGoogleSignIn}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              {t('auth.continueWithGoogle', 'Continue with Google')}
            </Button>

            <div className="mt-4 text-center">
              <Button variant="link" onClick={() => setIsLogin(!isLogin)} className="text-sm">
                {isLogin ? t('auth.noAccount') : t('auth.hasAccount')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {import.meta.env.DEV && window.location.hostname === 'localhost' && <AuthDebugPanel />}
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
