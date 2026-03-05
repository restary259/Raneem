import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Phone, Clock, Calendar, FileText, User, AlertTriangle, UserPlus, Copy, Check, MessageCircle } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import AppointmentSchedulerModal from '@/components/team/AppointmentSchedulerModal';
import AppointmentOutcomeModal from '@/components/team/AppointmentOutcomeModal';
import ProfileCompletionForm from '@/components/team/ProfileCompletionForm';
import PaymentConfirmationForm from '@/components/team/PaymentConfirmationForm';

interface Case {
  id: string; full_name: string; phone_number: string; status: string; source: string;
  assigned_to: string | null; last_activity_at: string; created_at: string; is_no_show: boolean;
  student_user_id: string | null; partner_id: string | null;
  // Extended fields from apply form
  city: string | null; education_level: string | null; bagrut_score: number | null;
  english_level: string | null; math_units: number | null; passport_type: string | null;
  degree_interest: string | null; intake_notes: string | null;
}
interface Appointment {
  id: string; scheduled_at: string; duration_minutes: number; outcome: string | null; notes: string | null; outcome_notes: string | null;
}
interface Submission { program_id: string | null; accommodation_id: string | null; program_start_date: string | null; program_end_date: string | null; service_fee: number; translation_fee: number; payment_confirmed: boolean; extra_data: Record<string, unknown> | null; }
interface Activity { id: string; action: string; actor_name: string | null; created_at: string; metadata: Record<string, unknown> | null; }

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  appointment_scheduled: 'bg-purple-100 text-purple-800',
  profile_completion: 'bg-orange-100 text-orange-800',
  payment_confirmed: 'bg-emerald-100 text-emerald-800',
  submitted: 'bg-teal-100 text-teal-800',
  enrollment_paid: 'bg-green-100 text-green-800',
  forgotten: 'bg-red-100 text-red-800',
};

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [showScheduler, setShowScheduler] = useState(false);
  const [outcomeApptId, setOutcomeApptId] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showCreateAccountModal, setShowCreateAccountModal] = useState(false);
  const [studentEmail, setStudentEmail] = useState('');
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [tempPasswordResult, setTempPasswordResult] = useState<string | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id || !user) return;
    setLoading(true);
    try {
      const [caseRes, apptRes, subRes, actRes] = await Promise.all([
        supabase.from('cases').select('*').eq('id', id).single(),
        supabase.from('appointments').select('*').eq('case_id', id).is('outcome', null).order('scheduled_at', { ascending: false }),
        supabase.from('case_submissions').select('*').eq('case_id', id).maybeSingle(),
        supabase.from('activity_log').select('*').eq('entity_id', id).order('created_at', { ascending: false }).limit(20),
      ]);
      if (caseRes.error) throw caseRes.error;
      setCaseData(caseRes.data as Case);
      setAppointments((apptRes.data as Appointment[]) ?? []);
      setSubmission(subRes.data as Submission | null);
      setActivity((actRes.data as Activity[]) ?? []);

      // Load profile if student linked
      if ((caseRes.data as Case).student_user_id) {
        const { data: prof } = await supabase.from('profiles').select('full_name, email, phone_number').eq('id', (caseRes.data as Case).student_user_id).maybeSingle();
        setProfile(prof as Record<string, unknown> | null);
      }
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setLoading(false);
    }
  }, [id, user, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateStatus = async (newStatus: string) => {
    if (!caseData) return;
    setUpdatingStatus(true);
    try {
      await supabase.from('cases').update({ status: newStatus }).eq('id', caseData.id);
      await supabase.rpc('log_activity' as any, {
        p_actor_id: user!.id,
        p_actor_name: 'Team Member',
        p_action: `status_changed_to_${newStatus}`,
        p_entity_type: 'case',
        p_entity_id: caseData.id,
        p_metadata: { from: caseData.status, to: newStatus },
      });
      toast({ title: `Status updated to ${newStatus.replace(/_/g, ' ')}` });
      fetchData();
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleCreateStudentAccount = async () => {
    if (!studentEmail.trim() || !caseData) return;
    setCreatingAccount(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-student-from-case`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session!.access_token}` },
        body: JSON.stringify({ case_id: caseData.id, student_email: studentEmail.trim(), student_full_name: caseData.full_name, student_phone: caseData.phone_number }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || 'Failed to create account');

      if (result.invited) {
        toast({ title: '✅ Invite Sent', description: `An invite email was sent to ${studentEmail}` });
        setShowCreateAccountModal(false);
      } else if (result.temp_password) {
        setTempPasswordResult(result.temp_password);
        setShowCreateAccountModal(false);
      } else {
        toast({ title: result.message || 'Account ready' });
        setShowCreateAccountModal(false);
      }
      fetchData();
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setCreatingAccount(false);
    }
  };

  const latestAppt = appointments[0];

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  if (!caseData) return <div className="p-6 text-muted-foreground">Case not found</div>;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/team/cases')}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{caseData.full_name}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-3 w-3" />{caseData.phone_number}
            <span>·</span>
            <Clock className="h-3 w-3" />{formatDistanceToNow(new Date(caseData.last_activity_at), { addSuffix: true })}
          </div>
        </div>
        <Badge className={STATUS_COLORS[caseData.status] ?? 'bg-muted'}>{caseData.status.replace(/_/g, ' ')}</Badge>
      </div>

      {/* Stage action block */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Next Action</CardTitle>
        </CardHeader>
        <CardContent>
          {caseData.status === 'new' && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Mark this case as contacted to proceed.</p>
              <Button onClick={() => updateStatus('contacted')} disabled={updatingStatus}>Mark as Contacted</Button>
            </div>
          )}
          {caseData.status === 'contacted' && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Schedule an appointment with the student.</p>
              <Button onClick={() => setShowScheduler(true)}>Schedule Appointment</Button>
            </div>
          )}
          {caseData.status === 'appointment_scheduled' && latestAppt && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Appointment: {format(new Date(latestAppt.scheduled_at), 'MMM d, h:mm a')}</p>
                {latestAppt.notes && <p className="text-xs text-muted-foreground">{latestAppt.notes}</p>}
              </div>
              {!latestAppt.outcome && (
                <Button onClick={() => setOutcomeApptId(latestAppt.id)}>Record Outcome</Button>
              )}
            </div>
          )}
          {caseData.status === 'profile_completion' && (
            <ProfileCompletionForm
              caseId={caseData.id}
              actorId={user!.id}
              actorName="Team Member"
              existingData={submission?.extra_data ?? {}}
              caseData={caseData}
              onSuccess={fetchData}
            />
          )}
          {caseData.status === 'payment_confirmed' && (
            <div className="space-y-4">
              <PaymentConfirmationForm
                caseId={caseData.id}
                actorId={user!.id}
                actorName="Team Member"
                onSuccess={fetchData}
              />
            </div>
          )}
          {/* Submit to Admin — appears after payment is confirmed */}
          {caseData.status === 'payment_confirmed' && submission?.payment_confirmed && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Ready to Submit?</p>
                  <p className="text-xs text-muted-foreground">Payment confirmed. Send this case to admin for enrollment.</p>
                </div>
                <Button
                  onClick={() => setShowSubmitConfirm(true)}
                  className="bg-primary"
                  disabled={updatingStatus}
                >
                  Submit to Admin
                </Button>
              </div>
            </div>
          )}
          {caseData.status === 'submitted' && (
            <div className="text-sm text-muted-foreground">✅ Case submitted — waiting for admin review and enrollment.</div>
          )}
          {caseData.status === 'enrollment_paid' && (
            <div className="text-sm font-medium text-primary">🎉 Student enrolled! Case complete.</div>
          )}
          {caseData.status === 'forgotten' && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-destructive">This case was marked forgotten. Re-contact if possible.</p>
              <Button variant="outline" onClick={() => updateStatus('contacted')}>Re-activate</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Appointments */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4" /> Appointments</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setShowScheduler(true)}>+ Add</Button>
          </CardHeader>
          <CardContent>
            {appointments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No appointments yet</p>
            ) : (
              <div className="space-y-3">
                {appointments.map(a => (
                  <div key={a.id} className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium">{format(new Date(a.scheduled_at), 'MMM d, h:mm a')}</div>
                      {a.outcome ? (
                        <Badge variant="secondary" className="text-xs">{a.outcome}</Badge>
                      ) : (
                        <Badge className="text-xs bg-primary/10 text-primary">Pending</Badge>
                      )}
                    </div>
                    {!a.outcome && (
                      <Button size="sm" variant="ghost" onClick={() => setOutcomeApptId(a.id)}>Record</Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submission info */}
        {submission && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Submission</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              {submission.service_fee > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Service Fee</span><span className="font-medium">{submission.service_fee.toLocaleString()} ILS</span></div>}
              {submission.translation_fee > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Translation</span><span className="font-medium">{submission.translation_fee.toLocaleString()} ILS</span></div>}
              {submission.program_start_date && <div className="flex justify-between"><span className="text-muted-foreground">Start</span><span>{submission.program_start_date}</span></div>}
              {submission.program_end_date && <div className="flex justify-between"><span className="text-muted-foreground">End</span><span>{submission.program_end_date}</span></div>}
              <div className="flex justify-between"><span className="text-muted-foreground">Payment</span><span className={submission.payment_confirmed ? 'text-green-600 font-medium' : 'text-amber-600'}>{ submission.payment_confirmed ? 'Confirmed' : 'Pending'}</span></div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Activity log */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" /> Activity Log</CardTitle>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity recorded yet</p>
          ) : (
            <div className="space-y-2">
              {activity.map((a, i) => (
                <div key={a.id}>
                  {i > 0 && <Separator />}
                  <div className="flex items-center justify-between py-1.5">
                    <div>
                      <span className="text-sm font-medium">{a.action.replace(/_/g, ' ')}</span>
                      {a.actor_name && <span className="text-xs text-muted-foreground ms-2">by {a.actor_name}</span>}
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {showScheduler && user && (
        <AppointmentSchedulerModal
          open={showScheduler}
          onClose={() => setShowScheduler(false)}
          caseId={caseData.id}
          teamMemberId={user.id}
          actorName="Team Member"
          onSuccess={fetchData}
        />
      )}
      {outcomeApptId && (
        <AppointmentOutcomeModal
          open={!!outcomeApptId}
          onClose={() => setOutcomeApptId(null)}
          appointmentId={outcomeApptId}
          onSuccess={fetchData}
        />
      )}

      {/* Submit to Admin confirmation dialog */}
      <Dialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Submit Case to Admin</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Have you reviewed all profile data? This will send the case to admin for enrollment processing.
            </p>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
              <p className="text-xs text-warning">This action cannot be undone.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitConfirm(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                setShowSubmitConfirm(false);
                await supabase.from('cases').update({ status: 'submitted' }).eq('id', caseData!.id);
                await supabase.from('case_submissions').update({ submitted_at: new Date().toISOString(), submitted_by: user!.id }).eq('case_id', caseData!.id);
                await supabase.rpc('log_activity' as any, {
                  p_actor_id: user!.id, p_actor_name: 'Team Member',
                  p_action: 'submitted_to_admin', p_entity_type: 'case', p_entity_id: caseData!.id,
                  p_metadata: {},
                });
                fetchData();
              }}
              disabled={updatingStatus}
            >
              Confirm & Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
