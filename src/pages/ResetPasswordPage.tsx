
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const ResetPasswordPage = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();

  useEffect(() => {
    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');
    
    if (!accessToken || !refreshToken) {
      toast({
        variant: "destructive",
        title: t('resetPassword.invalidLink'),
        description: t('resetPassword.invalidLinkDesc'),
      });
      navigate('/student-auth');
    }
  }, [searchParams, navigate, toast, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast({ variant: "destructive", title: t('resetPassword.error'), description: t('resetPassword.mismatch') });
      return;
    }

    if (password.length < 6) {
      toast({ variant: "destructive", title: t('resetPassword.error'), description: t('resetPassword.tooShort') });
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast({ title: t('resetPassword.success'), description: t('resetPassword.successDesc') });
      navigate('/student-auth');
    } catch (error: any) {
      toast({ variant: "destructive", title: t('resetPassword.error'), description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-orange-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{t('resetPassword.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">{t('resetPassword.newPassword')}</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} placeholder={t('resetPassword.newPasswordPlaceholder')} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                <Button type="button" variant="ghost" size="sm" className="absolute left-0 top-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('resetPassword.confirmPassword')}</Label>
              <div className="relative">
                <Input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} placeholder={t('resetPassword.confirmPasswordPlaceholder')} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />
                <Button type="button" variant="ghost" size="sm" className="absolute left-0 top-0 h-full px-3 py-2 hover:bg-transparent" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (<><Loader2 className="ml-2 h-4 w-4 animate-spin" />{t('resetPassword.updating')}</>) : t('resetPassword.submit')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPasswordPage;
