
import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck, KeyRound, Smartphone, CheckCircle2, Loader2, Eye, EyeOff } from 'lucide-react';
import { validatePassword } from '@/components/auth/PasswordStrength';
import PasswordStrength from '@/components/auth/PasswordStrength';
import { useToast } from '@/hooks/use-toast';

type GateStep = 'checking' | 'force-password' | 'enroll-totp' | 'verify-totp' | 'done';

interface Props {
  userId: string;
  onCleared: () => void;
}

const AdminSecurityGate: React.FC<Props> = ({ userId, onCleared }) => {
  const { toast } = useToast();
  const [step, setStep] = useState<GateStep>('checking');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPw, setConfirmPw]     = useState('');
  const [showPw, setShowPw]           = useState(false);
  const [showCpw, setShowCpw]         = useState(false);
  const [totpQr, setTotpQr]           = useState('');
  const [totpSecret, setTotpSecret]   = useState('');
  const [totpFactorId, setTotpFactorId] = useState('');
  const [totpCode, setTotpCode]       = useState('');
  const [verifyFactorId, setVerifyFactorId] = useState('');
  const [loading, setLoading]         = useState(false);

  const startEnrollment = async () => {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp', issuer: 'Darb Admin', friendlyName: 'Admin 2FA',
    });
    if (error || !data) {
      toast({ variant: 'destructive', title: 'Failed to start 2FA setup', description: error?.message });
      return;
    }
    setTotpQr(data.totp.qr_code);
    setTotpSecret(data.totp.secret);
    setTotpFactorId(data.id);
    setStep('enroll-totp');
  };

  useEffect(() => {
    const check = async () => {
      const { data: profile } = await supabase
        .from('profiles').select('must_change_password').eq('id', userId).maybeSingle();
      if (profile?.must_change_password) { setStep('force-password'); return; }

      const { data: mfaData } = await supabase.auth.mfa.listFactors();
      const verified = (mfaData?.totp ?? []).find(f => f.status === 'verified');
      if (!verified) { await startEnrollment(); return; }

      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalData?.currentLevel !== 'aal2') { setVerifyFactorId(verified.id); setStep('verify-totp'); return; }

      setStep('done');
      onCleared();
    };
    check();
  }, [userId]);

  const handlePasswordChange = async () => {
    if (!validatePassword(newPassword)) {
      toast({ variant: 'destructive', title: 'Password too weak', description: 'Satisfy all password rules.' });
      return;
    }
    if (newPassword !== confirmPw) {
      toast({ variant: 'destructive', title: 'Passwords do not match' });
      return;
    }
    setLoading(true);
    try {
      // Re-validate session is still alive before attempting password update
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        toast({ variant: 'destructive', title: 'Session expired', description: 'Please log in again.' });
        await supabase.auth.signOut();
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        // If auth session missing, the session token is stale — sign out and retry
        if (error.message.toLowerCase().includes('session') || error.message.toLowerCase().includes('missing')) {
          toast({ variant: 'destructive', title: 'Session expired', description: 'Please log in again.' });
          await supabase.auth.signOut();
          return;
        }
        throw error;
      }
      await supabase.from('profiles').update({ must_change_password: false } as any).eq('id', userId);
      toast({ title: '✅ Password updated' });

      const { data: mfaData } = await supabase.auth.mfa.listFactors();
      const verified = (mfaData?.totp ?? []).find(f => f.status === 'verified');
      if (!verified) {
        await startEnrollment();
      } else {
        const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aalData?.currentLevel !== 'aal2') { setVerifyFactorId(verified.id); setStep('verify-totp'); }
        else { setStep('done'); onCleared(); }
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleEnrollConfirm = async () => {
    if (totpCode.length !== 6) return;
    setLoading(true);
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId: totpFactorId });
      if (challenge.error) throw challenge.error;
      const { error } = await supabase.auth.mfa.verify({ factorId: totpFactorId, challengeId: challenge.data.id, code: totpCode });
      if (error) throw error;
      toast({ title: '🎉 2FA Enabled' });
      setStep('done');
      onCleared();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Invalid code', description: err.message });
      setTotpCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleTotpVerify = async () => {
    if (totpCode.length !== 6) return;
    setLoading(true);
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId: verifyFactorId });
      if (challenge.error) throw challenge.error;
      const { error } = await supabase.auth.mfa.verify({ factorId: verifyFactorId, challengeId: challenge.data.id, code: totpCode });
      if (error) throw error;
      setStep('done');
      onCleared();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Invalid code', description: 'Check your authenticator app.' });
      setTotpCode('');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'checking') return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-3">
        <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground text-sm">Checking security requirements…</p>
      </div>
    </div>
  );

  if (step === 'done') return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      {step === 'force-password' && (
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2">
              <div className="p-3 bg-amber-100 rounded-full">
                <KeyRound className="h-6 w-6 text-amber-600" />
              </div>
            </div>
            <CardTitle>Set a Strong Password</CardTitle>
            <CardDescription>Your admin account requires a new strong password before accessing the dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>New Password</Label>
              <div className="relative">
                <Input
                  type={showPw ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="pr-10"
                  autoFocus
                />
                <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <PasswordStrength password={newPassword} />
            </div>

            <div className="space-y-2">
              <Label>Confirm Password</Label>
              <div className="relative">
                <Input
                  type={showCpw ? 'text' : 'password'}
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  placeholder="Repeat new password"
                  className="pr-10"
                  onKeyDown={e => e.key === 'Enter' && handlePasswordChange()}
                />
                <button type="button" onClick={() => setShowCpw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showCpw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPw && newPassword !== confirmPw && <p className="text-xs text-destructive">Passwords do not match</p>}
            </div>

            <Button onClick={handlePasswordChange} disabled={loading} className="w-full">
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Set Password & Continue
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 'enroll-totp' && (
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2">
              <div className="p-3 bg-blue-100 rounded-full">
                <Smartphone className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <CardTitle>Enable Two-Factor Authentication</CardTitle>
            <CardDescription>Scan the QR code with Google Authenticator, Authy, or any TOTP app, then enter the 6-digit code.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {totpQr && (
              <div className="flex flex-col items-center gap-3">
                <div className="p-2 bg-white rounded-lg border">
                  <img src={totpQr} alt="TOTP QR Code" className="w-48 h-48" />
                </div>
                <details className="text-xs text-center text-muted-foreground">
                  <summary className="cursor-pointer">Can't scan? Enter the key manually</summary>
                  <code className="block mt-1 p-2 bg-muted rounded text-xs break-all">{totpSecret}</code>
                </details>
              </div>
            )}
            <div className="space-y-2">
              <Label>6-Digit Code from Your App</Label>
              <Input
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="text-center tracking-[0.5em] text-xl font-mono"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleEnrollConfirm()}
              />
            </div>
            <Button onClick={handleEnrollConfirm} disabled={loading || totpCode.length !== 6} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Activate 2FA
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 'verify-totp' && (
        <Card className="w-full max-w-md shadow-2xl">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2">
              <div className="p-3 bg-green-100 rounded-full">
                <ShieldCheck className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <CardTitle>Two-Factor Verification</CardTitle>
            <CardDescription>Enter the 6-digit code from your authenticator app.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Authenticator Code</Label>
              <Input
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="text-center tracking-[0.5em] text-xl font-mono"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleTotpVerify()}
              />
            </div>
            <Button onClick={handleTotpVerify} disabled={loading || totpCode.length !== 6} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
              Verify & Enter Dashboard
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminSecurityGate;
