import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ReassignDialogProps {
  reassignCase: any | null;
  allLawyers: { id: string; full_name: string }[];
  userId?: string;
  onClose: () => void;
  refetch: () => Promise<void>;
}

const ReassignDialog: React.FC<ReassignDialogProps> = ({ reassignCase, allLawyers, userId, onClose, refetch }) => {
  const { toast } = useToast();
  const { t } = useTranslation('dashboard');
  const [targetId, setTargetId] = useState('');
  const [notes, setNotes] = useState('');
  const [reassigning, setReassigning] = useState(false);

  React.useEffect(() => {
    if (reassignCase) { setTargetId(''); setNotes(''); }
  }, [reassignCase]);

  // Guard: only allow reassignment for pre-submission stages
  const REASSIGN_ALLOWED_STATUSES = ['new', 'contacted', 'appointment_scheduled', 'profile_completion', 'payment_confirmed'];

  const handleReassign = async () => {
    if (!reassignCase || !targetId) return;
    if (!REASSIGN_ALLOWED_STATUSES.includes(reassignCase.status)) {
      toast({ variant: 'destructive', title: t('common.error'), description: t('lawyer.reassignNotAllowed', 'Reassignment is only allowed before submission to admin.') });
      return;
    }
    setReassigning(true);
    try {
      const { error } = await (supabase as any).from('cases').update({
        assigned_to: targetId,
      }).eq('id', reassignCase.id);
      if (error) {
        toast({ variant: 'destructive', title: t('common.error'), description: error.message });
      } else {
        await (supabase as any).rpc('log_user_activity', { p_action: 'reassign_case', p_target_id: reassignCase.id, p_target_table: 'cases', p_details: `Reassigned to ${targetId}` });
        toast({ title: t('lawyer.caseReassigned') });
        onClose();
        try { await refetch(); } catch {}
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') toast({ variant: 'destructive', title: t('common.error'), description: err?.message || 'Unexpected error' });
    } finally {
      setReassigning(false);
    }
  };

  return (
    <Dialog open={!!reassignCase} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{t('lawyer.reassignCase')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs">{t('lawyer.selectNewMember')}</Label>
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger><SelectValue placeholder={t('lawyer.selectPlaceholder')} /></SelectTrigger>
              <SelectContent>
                {allLawyers.filter(l => l.id !== userId).map(l => (
                  <SelectItem key={l.id} value={l.id}>{l.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">{t('lawyer.notesOptional')}</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder={t('lawyer.reassignReason')} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={handleReassign} disabled={reassigning || !targetId}>{reassigning ? t('common.loading') : t('lawyer.reassign')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReassignDialog;
