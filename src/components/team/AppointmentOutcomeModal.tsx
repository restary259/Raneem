import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type Outcome = 'completed' | 'delayed' | 'cancelled' | 'rescheduled' | 'no_show';

const OUTCOMES: { value: Outcome; label: string; description: string }[] = [
  { value: 'completed', label: 'Completed', description: 'Meeting happened — move to profile completion' },
  { value: 'delayed', label: 'Delayed', description: 'Needs a new date — schedule another appointment' },
  { value: 'cancelled', label: 'Cancelled', description: 'Meeting cancelled — return to contacted' },
  { value: 'rescheduled', label: 'Rescheduled', description: 'New date set — create replacement appointment' },
  { value: 'no_show', label: 'No Show', description: 'Student did not appear — mark as forgotten' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  appointmentId: string;
  onSuccess: () => void;
}

export default function AppointmentOutcomeModal({ open, onClose, appointmentId, onSuccess }: Props) {
  const { toast } = useToast();
  const [outcome, setOutcome] = useState<Outcome>('completed');
  const [notes, setNotes] = useState('');
  const [newDate, setNewDate] = useState('');
  const [saving, setSaving] = useState(false);

  const needsNewDate = outcome === 'rescheduled' || outcome === 'delayed';

  const handleSave = async () => {
    if (needsNewDate && !newDate) {
      toast({ variant: 'destructive', description: 'Please provide a new date/time' });
      return;
    }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await supabase.functions.invoke('record-appointment-outcome', {
        body: {
          appointment_id: appointmentId,
          outcome,
          outcome_notes: notes || null,
          new_scheduled_at: needsNewDate && newDate ? new Date(newDate).toISOString() : null,
        },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (resp.error) throw new Error(resp.error.message);
      toast({ title: 'Outcome recorded' });
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
          <DialogTitle>Record Appointment Outcome</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <RadioGroup value={outcome} onValueChange={v => setOutcome(v as Outcome)}>
            {OUTCOMES.map(o => (
              <div key={o.value} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value={o.value} id={o.value} className="mt-0.5" />
                <Label htmlFor={o.value} className="cursor-pointer">
                  <span className="font-medium">{o.label}</span>
                  <p className="text-xs text-muted-foreground font-normal">{o.description}</p>
                </Label>
              </div>
            ))}
          </RadioGroup>

          {needsNewDate && (
            <div className="space-y-1">
              <Label>New Date & Time</Label>
              <Input
                type="datetime-local"
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>
          )}

          <div className="space-y-1">
            <Label>Notes (optional)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 me-2 animate-spin" />Saving...</> : 'Save Outcome'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
