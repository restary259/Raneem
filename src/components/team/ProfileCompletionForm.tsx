import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Program { id: string; name_en: string; name_ar: string; type: string; }
interface Accommodation { id: string; name_en: string; name_ar: string; price: number | null; currency: string; }

interface Props {
  caseId: string;
  actorId: string;
  actorName: string;
  existingData?: Record<string, unknown>;
  onSuccess: () => void;
}

export default function ProfileCompletionForm({ caseId, actorId, actorName, existingData, onSuccess }: Props) {
  const { toast } = useToast();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [saving, setSaving] = useState(false);

  const [programId, setProgramId] = useState((existingData?.program_id as string) ?? '');
  const [accommodationId, setAccommodationId] = useState((existingData?.accommodation_id as string) ?? '');
  const [startDate, setStartDate] = useState((existingData?.program_start_date as string) ?? '');
  const [endDate, setEndDate] = useState((existingData?.program_end_date as string) ?? '');
  const [studentName, setStudentName] = useState((existingData?.student_name as string) ?? '');
  const [studentPhone, setStudentPhone] = useState((existingData?.student_phone as string) ?? '');
  const [studentEmail, setStudentEmail] = useState((existingData?.student_email as string) ?? '');

  useEffect(() => {
    Promise.all([
      supabase.from('programs').select('id, name_en, name_ar, type').eq('is_active', true).order('name_en'),
      supabase.from('accommodations').select('id, name_en, name_ar, price, currency').eq('is_active', true),
    ]).then(([{ data: progs }, { data: accs }]) => {
      setPrograms(progs ?? []);
      setAccommodations(accs ?? []);
    });
  }, []);

  const handleSave = async () => {
    if (!studentName.trim()) {
      toast({ variant: 'destructive', description: 'Student name is required' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('case_submissions').upsert({
        case_id: caseId,
        program_id: programId || null,
        accommodation_id: accommodationId || null,
        program_start_date: startDate || null,
        program_end_date: endDate || null,
        extra_data: { student_name: studentName, student_phone: studentPhone, student_email: studentEmail },
      }, { onConflict: 'case_id' });
      if (error) throw error;

      // Update the case full_name / phone_number too
      await supabase.from('cases').update({
        full_name: studentName,
        phone_number: studentPhone || undefined,
      }).eq('id', caseId);

      await supabase.rpc('log_activity' as any, {
        p_actor_id: actorId,
        p_actor_name: actorName,
        p_action: 'profile_filled',
        p_entity_type: 'case',
        p_entity_id: caseId,
        p_metadata: {},
      });

      toast({ title: 'Profile saved' });
      onSuccess();
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Student Full Name *</Label>
          <Input value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="Full legal name" />
        </div>
        <div className="space-y-1">
          <Label>Phone</Label>
          <Input value={studentPhone} onChange={e => setStudentPhone(e.target.value)} placeholder="+972..." />
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label>Email</Label>
          <Input type="email" value={studentEmail} onChange={e => setStudentEmail(e.target.value)} placeholder="student@example.com" />
        </div>
        <div className="space-y-1">
          <Label>Program</Label>
          <Select value={programId} onValueChange={setProgramId}>
            <SelectTrigger><SelectValue placeholder="Select program" /></SelectTrigger>
            <SelectContent>
              {programs.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name_en} ({p.type})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Accommodation</Label>
          <Select value={accommodationId} onValueChange={setAccommodationId}>
            <SelectTrigger><SelectValue placeholder="Select accommodation" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {accommodations.map(a => (
                <SelectItem key={a.id} value={a.id}>{a.name_en} {a.price ? `(${a.price} ${a.currency})` : ''}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Program Start Date</Label>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Program End Date</Label>
          <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
      </div>
      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? <><Loader2 className="h-4 w-4 me-2 animate-spin" />Saving...</> : 'Save Profile'}
      </Button>
    </div>
  );
}
