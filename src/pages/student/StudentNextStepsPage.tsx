import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useAuthedUserId } from '@/hooks/useAuthedUserId';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, CheckCircle2, CreditCard, FileText, Globe, ListChecks, MessageSquare, User } from 'lucide-react';
import CaseMessages from '@/components/cases/CaseMessages';
import DashboardLoading from '@/components/dashboard/DashboardLoading';
import PaymentDisclosureCard from '@/components/student/PaymentDisclosureCard';
import { useDirection } from '@/hooks/useDirection';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { formatDateTime } from '@/utils/dateUtils';
import { CaseStatus } from '@/lib/caseStatus';

interface StepRow {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  detail: string;
  href: string;
  tone: string;
}


export default function StudentNextStepsPage() {
  const navigate = useNavigate();
  const { t } = useTranslation('dashboard');
  const { dir } = useDirection();

  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [caseStatus, setCaseStatus] = useState<string | null>(null);
  const [steps, setSteps] = useState<StepRow[]>([]);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showPayDisclosure, setShowPayDisclosure] = useState(false);

  const load = useCallback(async (uid: string) => {
    setLoading(true);
    setLoadError(null);

    const { data: profile, error: profileError } = await (supabase as any)
      .from('profiles')
      .select('full_name, passport_number, date_of_birth, emergency_contact_phone, case_id, linked_case_id')
      .eq('id', uid)
      .maybeSingle();
    if (profileError) {
      setLoadError(profileError.message);
      setLoading(false);
      return;
    }

    setFullName(profile?.full_name ?? '');
    // Students read their case through a restricted accessor that excludes
    // internal commission/revenue columns.
    const { data: ownCases, error: caseLookupError } = await (supabase as any).rpc('get_my_case');
    const ownCase = (ownCases ?? [])[0] ?? null;
    if (caseLookupError) {
      setLoadError(caseLookupError.message);
      setLoading(false);
      return;
    }
    const caseId: string | null = ownCase?.id ?? profile?.case_id ?? profile?.linked_case_id ?? null;
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
      const [apptRes, subRes] = await Promise.all([
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

      setCaseStatus(ownCase?.status ?? null);

      const appt = apptRes?.data?.[0];
      if (appt) {
        next.push({
          id: 'appointment',
          icon: CalendarDays,
          title: t('student.next.upcomingAppointment', 'Upcoming appointment'),
          detail: formatDateTime(appt.scheduled_at, ''),
          href: '/student/checklist',
          tone: 'text-primary',
        });
      }

      const balance = Number(subRes?.data?.remaining_balance ?? 0);
      setShowPayDisclosure(balance > 0 || ownCase?.status === CaseStatus.PAYMENT_CONFIRMED);
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

      if (ownCase?.status === CaseStatus.SUBMITTED || ownCase?.status === CaseStatus.ENROLLMENT_PAID) {
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

  const userId = useAuthedUserId(load);

  useRealtimeSubscription('documents', () => { if (userId) load(userId); }, !!userId);
  useRealtimeSubscription('appointments', () => { if (userId) load(userId); }, !!userId);

  if (!userId || loading) return <DashboardLoading />;

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl p-4 sm:p-6" dir={dir}>
        <Card><CardContent className="py-10 text-center text-sm text-destructive">{t('student.next.loadError')}</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6" dir={dir}>
      {showPayDisclosure && <PaymentDisclosureCard />}
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
