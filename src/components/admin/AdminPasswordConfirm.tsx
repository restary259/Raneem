import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  /** Extra sentence describing exactly what is about to be granted. */
  reason?: string;
  onCancel: () => void;
  onConfirmed: () => void;
}

/**
 * Administrator override gate. Used before any action that widens data access
 * (for example granting a partner visibility over every case). Requires both
 * the admin's own password (verified server-side) and a typed confirmation
 * phrase, so it cannot be triggered by a stray click.
 */
const AdminPasswordConfirm: React.FC<Props> = ({ open, reason, onCancel, onConfirmed }) => {
  const { t } = useTranslation('dashboard');
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [phrase, setPhrase] = useState('');
  const [loading, setLoading] = useState(false);

  const expectedPhrase = t('adminConfirm.phrase');

  const reset = () => {
    setPassword('');
    setPhrase('');
  };

  const confirm = async () => {
    if (!password || phrase.trim().toUpperCase() !== expectedPhrase.toUpperCase()) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-admin-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ password }),
        },
      );
      if (!resp.ok) {
        toast({ variant: 'destructive', description: t('adminConfirm.wrong') });
        return;
      }
      reset();
      onConfirmed();
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={v => { if (!v) { reset(); onCancel(); } }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            {t('adminConfirm.title')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {reason ? `${reason} ` : ''}{t('adminConfirm.desc')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t('adminConfirm.password')}</Label>
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('adminConfirm.phraseLabel')}</Label>
            <Input value={phrase} onChange={e => setPhrase(e.target.value)} dir="ltr" className="font-mono" />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => { reset(); onCancel(); }}>
            {t('adminConfirm.cancel')}
          </Button>
          <Button
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={confirm}
            disabled={loading || !password || phrase.trim().toUpperCase() !== expectedPhrase.toUpperCase()}
          >
            {loading && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
            {t('adminConfirm.confirm')}
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default AdminPasswordConfirm;
