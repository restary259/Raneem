import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Program { id: string; name_en: string; type: string; }
interface Accommodation { id: string; name_en: string; price: number | null; currency: string; }

export default function SubmitNewStudentPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [saving, setSaving] = useState(false);
  const [paymentReceived, setPaymentReceived] = useState(false);

  const [form, setForm] = useState({
    full_name: '', phone_number: '', email: '',
    program_id: '', accommodation_id: '',
    start_date: '', end_date: '',
    service_fee: '', translation_fee: '0',
  });

  useEffect(() => {
    Promise.all([
      supabase.from('programs').select('id, name_en, type').eq('is_active', true),
      supabase.from('accommodations').select('id, name_en, price, currency').eq('is_active', true),
    ]).then(([{ data: p }, { data: a }]) => { setPrograms(p ?? []); setAccommodations(a ?? []); });
  }, []);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    const { full_name, phone_number, email, service_fee } = form;
    if (!full_name.trim() || !phone_number.trim() || !email.trim()) {
      toast({ variant: 'destructive', description: 'Name, phone, and email are required' });
      return;
    }
    if (!paymentReceived) {
      toast({ variant: 'destructive', description: 'You must confirm payment was received' });
      return;
    }
    if (!service_fee || parseFloat(service_fee) <= 0) {
      toast({ variant: 'destructive', description: 'Service fee is required' });
      return;
    }

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const { data: newCase, error: caseErr } = await supabase.from('cases').insert({
        full_name: full_name.trim(),
        phone_number: phone_number.trim(),
        source: 'submit_new_student',
        status: 'enrollment_paid',
        assigned_to: user!.id,
      }).select().single();
      if (caseErr) throw caseErr;

      await supabase.from('case_submissions').insert({
        case_id: (newCase as any).id,
        program_id: form.program_id || null,
        accommodation_id: form.accommodation_id || null,
        program_start_date: form.start_date || null,
        program_end_date: form.end_date || null,
        service_fee: parseFloat(service_fee),
        translation_fee: parseFloat(form.translation_fee) || 0,
        payment_confirmed: true,
        payment_confirmed_at: now,
        payment_confirmed_by: user!.id,
        submitted_at: now,
        submitted_by: user!.id,
        enrollment_paid_at: now,
        enrollment_paid_by: user!.id,
      });

      // Create student account
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.functions.invoke('create-student-from-case', {
        body: { case_id: (newCase as any).id, student_email: email.trim(), student_full_name: full_name.trim(), student_phone: phone_number.trim() },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      await supabase.rpc('log_activity' as any, {
        p_actor_id: user!.id,
        p_actor_name: 'Team Member',
        p_action: 'student_submitted_direct',
        p_entity_type: 'case',
        p_entity_id: (newCase as any).id,
        p_metadata: { full_name, email },
      });

      toast({ title: 'Student submitted & enrolled' });
      navigate(`/team/cases/${(newCase as any).id}`);
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const total = (parseFloat(form.service_fee) || 0) + (parseFloat(form.translation_fee) || 0);

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/team/cases')}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-2xl font-bold">Submit New Student</h1>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Student Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div><Label>Full Name *</Label><Input value={form.full_name} onChange={e => set('full_name', e.target.value)} /></div>
            <div><Label>Phone *</Label><Input value={form.phone_number} onChange={e => set('phone_number', e.target.value)} /></div>
            <div className="md:col-span-2"><Label>Email *</Label><Input type="email" value={form.email} onChange={e => set('email', e.target.value)} /></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Program & Accommodation</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div><Label>Program</Label>
              <Select value={form.program_id} onValueChange={v => set('program_id', v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{programs.map(p => <SelectItem key={p.id} value={p.id}>{p.name_en}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Accommodation</Label>
              <Select value={form.accommodation_id} onValueChange={v => set('accommodation_id', v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {accommodations.map(a => <SelectItem key={a.id} value={a.id}>{a.name_en}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Start Date</Label><Input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} /></div>
            <div><Label>End Date</Label><Input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} /></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Payment</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div><Label>Service Fee (ILS) *</Label><Input type="number" min="0" value={form.service_fee} onChange={e => set('service_fee', e.target.value)} /></div>
            <div><Label>Translation Fee (ILS)</Label><Input type="number" min="0" value={form.translation_fee} onChange={e => set('translation_fee', e.target.value)} /></div>
          </div>
          {total > 0 && (
            <div className="flex justify-between p-3 rounded-lg bg-muted text-sm font-medium">
              <span>Total</span><span>{total.toLocaleString()} ILS</span>
            </div>
          )}
          <div className="flex items-start gap-3 p-3 border rounded-lg">
            <Checkbox id="pr" checked={paymentReceived} onCheckedChange={v => setPaymentReceived(v === true)} />
            <Label htmlFor="pr" className="cursor-pointer text-sm">I confirm full payment of {total.toLocaleString()} ILS has been received.</Label>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSubmit} disabled={saving} className="w-full" size="lg">
        {saving ? <><Loader2 className="h-4 w-4 me-2 animate-spin" />Submitting...</> : 'Submit & Create Student Account'}
      </Button>
    </div>
  );
}
