import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KeyRound, Loader2, Eye, EyeOff } from 'lucide-react';
import PasswordStrength, { validatePassword } from '@/components/auth/PasswordStrength';
import { useToast } from '@/hooks/use-toast';

interface Props {
  userId: string;
  onDone: () => void;
}

/**
 * Blocking screen shown to any signed-in non-admin account that still carries a
 * temporary password (`profiles.must_change_password`). No dashboard route is
 * reachable until a strong password is set and confirmed.
 */
const ForcePasswordChange: React.FC<Props> = ({ userId, onDone }) => {
  const { t } = useTranslation('dashboard');
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showCpw, setShowCpw] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!validatePassword(password)) {
      toast({ variant: 'destructive', description: t('forcePassword.weak') });
      return;
    }
    if (password !== confirm) {
      toast({ variant: 'destructive', description: t('forcePassword.mismatch') });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      // A retry after an already-successful change reports "same password" — that is not a
      // failure here, the flag below still needs clearing.
      if (error && !/same[_ ]password|different from the old/i.test(error.message)) throw error;
      const { error: flagError } = await (supabase as any).rpc('clear_must_change_password');
      if (flagError) throw flagError;
      toast({ description: t('forcePassword.success') });
      onDone();
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <div className="p-3 bg-primary/10 rounded-full">
              <KeyRound className="h-6 w-6 text-primary" />
            </div>
          </div>
          <CardTitle>{t('forcePassword.title')}</CardTitle>
          <CardDescription>{t('forcePassword.desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t('forcePassword.new')}</Label>
            <div className="relative">
              <Input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={t('forcePassword.newPlaceholder')}
                autoComplete="new-password"
                className="pe-10"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={t('forcePassword.new')}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <PasswordStrength password={password} />
          </div>

          <div className="space-y-2">
            <Label>{t('forcePassword.confirm')}</Label>
            <div className="relative">
              <Input
                type={showCpw ? 'text' : 'password'}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder={t('forcePassword.confirmPlaceholder')}
                autoComplete="new-password"
                className="pe-10"
                onKeyDown={e => e.key === 'Enter' && submit()}
              />
              <button
                type="button"
                onClick={() => setShowCpw(v => !v)}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={t('forcePassword.confirm')}
              >
                {showCpw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirm && password !== confirm && (
              <p className="text-xs text-destructive">{t('forcePassword.mismatch')}</p>
            )}
          </div>

          <Button className="w-full" onClick={submit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
            {t('forcePassword.submit')}
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => supabase.auth.signOut()}>
            {t('forcePassword.signOut')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ForcePasswordChange;
