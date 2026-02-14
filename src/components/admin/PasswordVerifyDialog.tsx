import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PasswordVerifyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: () => void;
  title?: string;
  description?: string;
}

const PasswordVerifyDialog: React.FC<PasswordVerifyDialogProps> = ({
  open, onOpenChange, onVerified,
  title: titleProp,
  description: descProp,
}) => {
  const { t } = useTranslation('dashboard');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const dialogTitle = titleProp || t('admin.passwordVerify.title');
  const dialogDesc = descProp || t('admin.passwordVerify.description');

  const handleVerify = async () => {
    if (!password.trim()) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error(t('admin.passwordVerify.userNotFound'));

      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });

      if (error) {
        toast({ variant: 'destructive', title: t('admin.passwordVerify.verifyFailed'), description: t('admin.passwordVerify.wrongPassword') });
        setLoading(false);
        return;
      }

      setPassword('');
      onOpenChange(false);
      onVerified();
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('common.error'), description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setPassword(''); onOpenChange(v); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-amber-500" />
            {dialogTitle}
          </DialogTitle>
          <DialogDescription>{dialogDesc}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="verify-password">{t('admin.passwordVerify.password')}</Label>
            <Input
              id="verify-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
              placeholder={t('admin.passwordVerify.placeholder')}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{t('admin.passwordVerify.cancel')}</Button>
          <Button onClick={handleVerify} disabled={loading || !password.trim()}>
            {loading ? t('admin.passwordVerify.verifying') : t('admin.passwordVerify.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PasswordVerifyDialog;
