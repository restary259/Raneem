import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, CheckCircle2, CreditCard, FileText, Globe, ListChecks, MessageSquare, User } from 'lucide-react';
import CaseMessages from '@/components/cases/CaseMessages';
import DashboardLoading from '@/components/dashboard/DashboardLoading';
import { useDirection } from '@/hooks/useDirection';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

interface StepRow {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  detail: string;
  href: string;
  tone: string;
}

const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

export default function StudentNextStepsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation('dashboard');
  const { dir } = useDirection();

  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [caseStatus, setCaseStatus] = useState<string | null>(null);
  const [steps, setSteps] = useState<StepRow[]>([]);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);

  const load = useCallback(async (uid: string) => {
    setLoading(true);

    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('full_name, passport_number, date_of_birth, emergency_contact_phone, case_id, linked_case_id')
      .eq('id', uid)
      .maybeSingle();

    setFullName(profile?.full_name ?? '');
    const caseId: string | null = profile?.case_id ?? profile?.linked_case_id ?? null;
    setActiveCaseId(caseId);

    const next: StepRow[] = [];

    // Profile completeness
    if (!profile?.passport_number || !profile?.date_of_birth || !profile?.emergency_contact_phone) {
      next.push({
        id: 'profile',
        icon: User,
        title: t('student.next.completeProfile', 'Complete your profile'),
        detail: t('student.next.completeProfileDetail', 'Passport, date of birth and emergency contact are required.'),
        href: '/student/profile',
        tone: 'text-amber-600',
      });
    }

    // Documents
    const { count: docCount } = await (supabase as any)
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('student_id', uid)
      .is('deleted_at', null);

    if (!docCount) {
      next.push({
        id: 'documents',
        icon: FileText,
        title: t('student.next.uploadDocuments', 'Upload your documents'),
        detail: t('student.next.uploadDocumentsDetail', 'Start with your passport copy and certificates.'),
        href: '/student/documents',
        tone: 'text-blue-600',
      });
    }

    if (caseId) {
      const [caseRes, apptRes, subRes] = await Promise.all([
        (supabase as any).from('cases').select('status').eq('id', caseId).maybeSingle(),
        (supabase as any)
          .from('appointments')
          .select('scheduled_at')
          .eq('case_id', caseId)
          .gte('scheduled_at', new Date().toISOString())
          .order('scheduled_at')
          .limit(1),
        (supabase as any)
          .from('case_submissions')
          .select('remaining_balance')
          .eq('case_id', caseId)
          .is('deleted_at', null)
          .maybeSingle(),
      ]);

      setCaseStatus(caseRes?.data?.status ?? null);

      const appt = apptRes?.data?.[0];
      if (appt) {
        next.push({
          id: 'appointment',
          icon: CalendarDays,
          title: t('student.next.upcomingAppointment', 'Upcoming appointment'),
          detail: fmtDateTime(appt.scheduled_at),
          href: '/student/checklist',
          tone: 'text-primary',
        });
      }

      const balance = Number(subRes?.data?.remaining_balance ?? 0);
      if (balance > 0) {
        next.push({
          id: 'balance',
          icon: CreditCard,
          title: t('student.next.outstandingBalance', 'Outstanding balance'),
          detail: `₪${balance.toLocaleString('en-US')}`,
          href: '/student/checklist',
          tone: 'text-destructive',
        });
      }

      if (caseRes?.data?.status === 'submitted' || caseRes?.data?.status === 'enrollment_paid') {
        next.push({
          id: 'visa',
          icon: Globe,
          title: t('student.next.prepareVisa', 'Prepare your visa file'),
          detail: t('student.next.prepareVisaDetail', 'Fill in the visa form fields and upload the required proofs.'),
          href: '/student/visa',
          tone: 'text-teal-600',
        });
      }
    }

    setSteps(next);
    setLoading(false);
  }, [t]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) { navigate('/student-auth'); return; }
      setUserId(session.user.id);
      load(session.user.id);
    });
  }, [navigate, load]);

  useRealtimeSubscription('documents', () => { if (userId) load(userId); }, !!userId);
  useRealtimeSubscription('appointments', () => { if (userId) load(userId); }, !!userId);

  if (!userId || loading) return <DashboardLoading />;

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6" dir={dir}>
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t('student.next.title', 'Your next steps')}
          {fullName ? ` — ${fullName}` : ''}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('student.next.subtitle', 'Everything that needs your attention right now.')}
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-primary" />
            {t('student.next.tasks', 'Tasks')}
            <Badge variant="secondary">{steps.length}</Badge>
          </CardTitle>
          {caseStatus && (
            <Badge variant="outline">
              {t(`partner.status.${caseStatus}`, { defaultValue: caseStatus })}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {steps.length === 0 ? (
            <div className="py-12 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500/50 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {t('student.next.allClear', 'You are all caught up. We will notify you when something is needed.')}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {steps.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <s.icon className={`h-4 w-4 mt-0.5 shrink-0 ${s.tone}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{s.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{s.detail}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => navigate(s.href)}>
                    {t('student.next.open', 'Open')}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {activeCaseId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              {t('case.messages.title', 'Messages')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CaseMessages caseId={activeCaseId} />
          </CardContent>
        </Card>
      )}
    </div>

  );
}
