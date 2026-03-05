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
import {
  ArrowLeft, Phone, Clock, Calendar, FileText, User, AlertTriangle,
  UserPlus, Copy, Check, MessageCircle, ChevronRight, CheckCircle2,
  CalendarClock, CreditCard, SendHorizonal, GraduationCap,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import AppointmentSchedulerModal from '@/components/team/AppointmentSchedulerModal';
import AppointmentOutcomeModal from '@/components/team/AppointmentOutcomeModal';
import ProfileCompletionForm from '@/components/team/ProfileCompletionForm';
import PaymentConfirmationForm from '@/components/team/PaymentConfirmationForm';
import RescheduleDialog from '@/components/team/RescheduleDialog';

interface Case {
  id: string; full_name: string; phone_number: string; status: string; source: string;
  assigned_to: string | null; last_activity_at: string; created_at: string; is_no_show: boolean;
  student_user_id: string | null; partner_id: string | null;
  city: string | null; education_level: string | null; bagrut_score: number | null;
  english_level: string | null; math_units: number | null; passport_type: string | null;
  degree_interest: string | null; intake_notes: string | null;
}
interface Appointment {
  id: string; scheduled_at: string; duration_minutes: number; outcome: string | null;
  notes: string | null; outcome_notes: string | null;
}
interface Submission {
  program_id: string | null; accommodation_id: string | null; program_start_date: string | null;
  program_end_date: string | null; service_fee: number; translation_fee: number;
  payment_confirmed: boolean; extra_data: Record<string, unknown> | null;
  submitted_at: string | null;
}
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

const OUTCOME_COLORS: Record<string, string> = {
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  rescheduled: 'bg-blue-100 text-blue-800',
  delayed: 'bg-yellow-100 text-yellow-800',
  no_show: 'bg-orange-100 text-orange-800',
};

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { i18n } = useTranslation('dashboard');
  const isAr = i18n.language === 'ar';

  const [caseData, setCaseData] = useState<Case | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [showScheduler, setShowScheduler] = useState(false);
  const [outcomeApptId, setOutcomeApptId] = useState<string | null>(null);
  const [rescheduleAppt, setRescheduleAppt] = useState<Appointment | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showCreateAccountModal, setShowCreateAccountModal] = useState(false);
  const [studentEmail, setStudentEmail] = useState('');
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [tempPasswordResult, setTempPasswordResult] = useState<string | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);
  // profile_completion stage: track if user just saved profile (to show payment form)
  const [profileJustSaved, setProfileJustSaved] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id || !user) return;
    setLoading(true);
    try {
      const [caseRes, apptRes, subRes, actRes] = await Promise.all([
        supabase.from('cases').select('*').eq('id', id).single(),
        // Fetch ALL appointments (not just pending) so we see outcomes too
        supabase.from('appointments').select('*').eq('case_id', id).order('scheduled_at', { ascending: false }),
        supabase.from('case_submissions').select('*').eq('case_id', id).maybeSingle(),
        supabase.from('activity_log').select('*').eq('entity_id', id).order('created_at', { ascending: false }).limit(20),
      ]);
      if (caseRes.error) throw caseRes.error;
      setCaseData(caseRes.data as Case);
      setAppointments((apptRes.data as Appointment[]) ?? []);
      setSubmission(subRes.data as Submission | null);
      setActivity((actRes.data as Activity[]) ?? []);

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

  // The latest appointment (most recent, regardless of outcome)
  const latestAppt = appointments[0] ?? null;
  // Is there any pending (no outcome) appointment?
  const pendingAppt = appointments.find(a => !a.outcome) ?? null;

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  if (!caseData) return <div className="p-6 text-muted-foreground">Case not found</div>;

  /* ── helpers ── */
  const profileIsReady = !!submission; // submission exists = profile was saved

  const renderNextAction = () => {
    const { status } = caseData;

    if (status === 'new') return (
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-medium text-sm">Mark as Contacted</p>
          <p className="text-xs text-muted-foreground mt-0.5">Start the pipeline by marking this lead as contacted.</p>
        </div>
        <Button onClick={() => updateStatus('contacted')} disabled={updatingStatus} className="shrink-0">
          Mark Contacted <ChevronRight className="h-4 w-4 ms-1" />
        </Button>
      </div>
    );

    if (status === 'contacted') return (
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-medium text-sm">Schedule an Appointment</p>
          <p className="text-xs text-muted-foreground mt-0.5">Book a time to discuss the student's application.</p>
        </div>
        <Button onClick={() => setShowScheduler(true)} className="shrink-0">
          <CalendarClock className="h-4 w-4 me-1" /> Schedule
        </Button>
      </div>
    );

    if (status === 'appointment_scheduled') {
      if (pendingAppt) {
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-sm flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-primary" />
                  {format(new Date(pendingAppt.scheduled_at), 'EEE, MMM d · h:mm a')}
                </p>
                {pendingAppt.notes && <p className="text-xs text-muted-foreground mt-0.5">{pendingAppt.notes}</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={() => setRescheduleAppt(pendingAppt)}>
                  Reschedule
                </Button>
                <Button size="sm" onClick={() => setOutcomeApptId(pendingAppt.id)}>
                  Record Outcome <ChevronRight className="h-4 w-4 ms-1" />
                </Button>
              </div>
            </div>
          </div>
        );
      }
      // All appointments have outcomes but status didn't change (edge fn may have moved it already)
      return (
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium text-sm text-amber-700">All outcomes recorded</p>
            <p className="text-xs text-muted-foreground mt-0.5">The appointment outcome was recorded. Manually advance if needed.</p>
          </div>
          <Button size="sm" onClick={() => updateStatus('profile_completion')} disabled={updatingStatus}>
            Go to Profile Stage <ChevronRight className="h-4 w-4 ms-1" />
          </Button>
        </div>
      );
    }

    if (status === 'profile_completion') {
      // Show profile form if profile not yet saved
      if (!profileIsReady && !profileJustSaved) {
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <User className="h-4 w-4 text-primary" />
              <p className="font-medium text-sm">Complete Student Profile</p>
            </div>
            <ProfileCompletionForm
              caseId={caseData.id}
              actorId={user!.id}
              actorName="Team Member"
              existingData={submission?.extra_data ?? {}}
              caseData={caseData}
              onSuccess={() => { setProfileJustSaved(true); fetchData(); }}
            />
          </div>
        );
      }
      // Profile saved → show payment form
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            <p className="text-sm text-green-800 font-medium">Profile Complete — Confirm Payment to Proceed</p>
          </div>
          {submission && (
            <div className="text-sm space-y-1 px-1">
              {submission.service_fee > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Service Fee</span><span className="font-medium text-foreground">{submission.service_fee.toLocaleString()} ILS</span>
                </div>
              )}
              {submission.translation_fee > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Translation</span><span className="font-medium text-foreground">{submission.translation_fee.toLocaleString()} ILS</span>
                </div>
              )}
              {submission.program_start_date && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Start Date</span><span>{submission.program_start_date}</span>
                </div>
              )}
            </div>
          )}
          <PaymentConfirmationForm
            caseId={caseData.id}
            actorId={user!.id}
            actorName="Team Member"
            onSuccess={() => { fetchData(); }}
          />
        </div>
      );
    }

    if (status === 'payment_confirmed') {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
            <CreditCard className="h-4 w-4 text-emerald-600 shrink-0" />
            <p className="text-sm text-emerald-800 font-medium">Payment Confirmed — Submit Case to Admin</p>
          </div>
          {submission && (
            <div className="text-sm space-y-1 px-1">
              {submission.service_fee > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Service Fee</span><span className="font-medium text-foreground">{submission.service_fee.toLocaleString()} ILS</span>
                </div>
              )}
              {submission.program_start_date && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Program Start</span><span>{submission.program_start_date}</span>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={() => setShowSubmitConfirm(true)} disabled={updatingStatus}>
              <SendHorizonal className="h-4 w-4 me-1" /> Submit to Admin
            </Button>
          </div>
        </div>
      );
    }

    if (status === 'submitted') return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-teal-50 border border-teal-200">
        <CheckCircle2 className="h-5 w-5 text-teal-600 shrink-0" />
        <div>
          <p className="text-sm font-medium text-teal-800">Submitted to Admin</p>
          <p className="text-xs text-teal-700 mt-0.5">Waiting for admin review and enrollment confirmation.</p>
        </div>
      </div>
    );

    if (status === 'enrollment_paid') return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
        <GraduationCap className="h-5 w-5 text-green-600 shrink-0" />
        <div>
          <p className="text-sm font-medium text-green-800">🎉 Student Enrolled</p>
          <p className="text-xs text-green-700 mt-0.5">Case complete. Student is enrolled in the program.</p>
        </div>
      </div>
    );

    if (status === 'forgotten') return (
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-destructive">This case was marked forgotten. Re-contact if possible.</p>
        <Button variant="outline" onClick={() => updateStatus('contacted')}>Re-activate</Button>
      </div>
    );

    return null;
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold truncate">{caseData.full_name}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <Phone className="h-3 w-3" />{caseData.phone_number}
            <span>·</span>
            <Clock className="h-3 w-3" />{formatDistanceToNow(new Date(caseData.last_activity_at), { addSuffix: true })}
            {caseData.city && <><span>·</span><span>{caseData.city}</span></>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={STATUS_COLORS[caseData.status] ?? 'bg-muted'}>{caseData.status.replace(/_/g, ' ')}</Badge>
          {!caseData.student_user_id && ['profile_completion','payment_confirmed','submitted','enrollment_paid'].includes(caseData.status) && (
            <Button size="sm" variant="outline" className="gap-1" onClick={() => { setStudentEmail(''); setShowCreateAccountModal(true); }}>
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Create Student Account</span>
            </Button>
          )}
          {caseData.student_user_id && (
            <Badge variant="secondary" className="gap-1 text-xs"><User className="h-3 w-3" />Account Active</Badge>
          )}
        </div>
      </div>

      {/* Student Info Summary */}
      {(caseData.degree_interest || caseData.education_level || caseData.passport_type) && (
        <Card>
          <CardContent className="p-4 flex flex-wrap gap-4 text-sm">
            {caseData.degree_interest && (
              <div><span className="text-muted-foreground">Degree: </span><span className="font-medium">{caseData.degree_interest}</span></div>
            )}
            {caseData.education_level && (
              <div><span className="text-muted-foreground">Education: </span><span className="font-medium">{caseData.education_level}</span></div>
            )}
            {caseData.passport_type && (
              <div><span className="text-muted-foreground">Passport: </span><span className="font-medium">{caseData.passport_type.replace(/_/g, ' ')}</span></div>
            )}
            {caseData.math_units != null && (
              <div><span className="text-muted-foreground">Math Units: </span><span className="font-medium">{caseData.math_units}</span></div>
            )}
            {caseData.english_level && (
              <div><span className="text-muted-foreground">English: </span><span className="font-medium">{caseData.english_level}</span></div>
            )}
            {caseData.intake_notes && (
              <div className="w-full"><span className="text-muted-foreground">Notes: </span><span>{caseData.intake_notes}</span></div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Next Action Card */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Next Action</CardTitle>
        </CardHeader>
        <CardContent>
          {renderNextAction()}
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
                  <div key={a.id} className="flex items-start justify-between gap-2 pb-3 last:pb-0 border-b last:border-b-0 border-border">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{format(new Date(a.scheduled_at), 'EEE, MMM d · h:mm a')}</div>
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        {a.outcome ? (
                          <Badge className={`text-xs ${OUTCOME_COLORS[a.outcome] ?? 'bg-muted text-muted-foreground'}`}>{a.outcome}</Badge>
                        ) : (
                          <Badge className="text-xs bg-primary/10 text-primary border-primary/20">Pending</Badge>
                        )}
                        {a.outcome_notes && <span className="text-xs text-muted-foreground truncate">{a.outcome_notes}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {!a.outcome && (
                        <>
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setRescheduleAppt(a)}>Reschedule</Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setOutcomeApptId(a.id)}>Outcome</Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submission / Course Info */}
        {submission ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Course & Payment</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              {submission.service_fee > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Service Fee</span><span className="font-medium">{submission.service_fee.toLocaleString()} ILS</span></div>}
              {submission.translation_fee > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Translation</span><span className="font-medium">{submission.translation_fee.toLocaleString()} ILS</span></div>}
              {submission.program_start_date && <div className="flex justify-between"><span className="text-muted-foreground">Start Date</span><span>{submission.program_start_date}</span></div>}
              {submission.program_end_date && <div className="flex justify-between"><span className="text-muted-foreground">End Date</span><span>{submission.program_end_date}</span></div>}
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment</span>
                <span className={submission.payment_confirmed ? 'text-green-600 font-medium' : 'text-amber-600'}>
                  {submission.payment_confirmed ? '✅ Confirmed' : '⏳ Pending'}
                </span>
              </div>
              {submission.submitted_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Submitted</span>
                  <span>{format(new Date(submission.submitted_at), 'MMM d, yyyy')}</span>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          /* Student link info if account exists */
          caseData.student_user_id && profile ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" /> Student Account</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span>{String(profile.full_name ?? '')}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{String(profile.email ?? '')}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span>{String(profile.phone_number ?? '')}</span></div>
              </CardContent>
            </Card>
          ) : null
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

      {/* Modals */}
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
          onSuccess={() => { fetchData(); }}
        />
      )}
      <RescheduleDialog
        appointment={rescheduleAppt}
        onClose={() => setRescheduleAppt(null)}
        refetch={fetchData}
      />

      {/* Submit to Admin confirmation */}
      <Dialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Submit Case to Admin</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Have you reviewed all profile data? This will send the case to admin for enrollment processing.
            </p>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <p className="text-xs text-amber-700">This action cannot be undone.</p>
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

      {/* Create Student Account modal */}
      <Dialog open={showCreateAccountModal} onOpenChange={setShowCreateAccountModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" />Create Student Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Enter the student's email. An invite link will be sent so they can set their own password.</p>
            <div>
              <Label>Student Email</Label>
              <Input
                type="email"
                value={studentEmail}
                onChange={e => setStudentEmail(e.target.value)}
                placeholder="student@example.com"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateAccountModal(false)}>Cancel</Button>
            <Button onClick={handleCreateStudentAccount} disabled={creatingAccount || !studentEmail.trim()}>
              {creatingAccount ? 'Creating…' : 'Create Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Temp password credentials modal */}
      <Dialog open={!!tempPasswordResult} onOpenChange={() => setTempPasswordResult(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>✅ Student Account Created</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Share these credentials with the student. The password will not be shown again.</p>
            <div className="p-3 rounded-lg bg-muted font-mono text-sm select-all break-all">{tempPasswordResult}</div>
            <div className="flex gap-2">
              <Button
                variant="outline" size="sm" className="flex-1 gap-1"
                onClick={() => {
                  navigator.clipboard.writeText(tempPasswordResult ?? '');
                  setCopiedPassword(true);
                  setTimeout(() => setCopiedPassword(false), 2000);
                }}
              >
                {copiedPassword ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copiedPassword ? 'Copied!' : 'Copy Password'}
              </Button>
              <Button
                size="sm" className="flex-1 gap-1 bg-green-600 hover:bg-green-700"
                onClick={() => {
                  const msg = encodeURIComponent(
                    `مرحبا ${caseData?.full_name ?? ''},\nإليك بيانات تسجيل الدخول لبوابة DARB:\n🔗 darb.agency/login\n🔑 كلمة المرور المؤقتة: ${tempPasswordResult}\n\nيرجى تغيير كلمة المرور عند أول دخول.`
                  );
                  window.open(`https://wa.me/?text=${msg}`, '_blank');
                }}
              >
                <MessageCircle className="h-4 w-4" />
                Share via WhatsApp
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setTempPasswordResult(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
