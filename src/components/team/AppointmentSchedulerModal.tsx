import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onClose: () => void;
  caseId: string;
  teamMemberId: string;
  actorName: string;
  onSuccess: () => void;
}

export default function AppointmentSchedulerModal({ open, onClose, caseId, teamMemberId, actorName, onSuccess }: Props) {
  const { toast } = useToast();
  const [scheduledAt, setScheduledAt] = useState('');
  const [duration, setDuration] = useState(60);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!scheduledAt) {
      toast({ variant: 'destructive', description: 'Please select a date and time' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('appointments').insert({
        case_id: caseId,
        team_member_id: teamMemberId,
        scheduled_at: new Date(scheduledAt).toISOString(),
        duration_minutes: duration,
        notes: notes || null,
      });
      if (error) throw error;

      // Update case status
      await supabase.from('cases').update({ status: 'appointment_scheduled' }).eq('id', caseId);

      // Log activity
      await supabase.rpc('log_activity' as any, {
        p_actor_id: teamMemberId,
        p_actor_name: actorName,
        p_action: 'appointment_scheduled',
        p_entity_type: 'case',
        p_entity_id: caseId,
        p_metadata: { scheduled_at: scheduledAt },
      });

      toast({ title: 'Appointment scheduled' });
      onSuccess();
      onClose();
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule Appointment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Date & Time</Label>
            <Input
              type="datetime-local"
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
            />
          </div>
          <div className="space-y-1">
            <Label>Duration (minutes)</Label>
            <Input
              type="number"
              min={15}
              max={240}
              step={15}
              value={duration}
              onChange={e => setDuration(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1">
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 me-2 animate-spin" />Saving...</> : 'Schedule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
