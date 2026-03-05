import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { FileCheck, Calendar, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';

interface MyApplicationTabProps {
  userId: string;
}

// Canonical 6-stage pipeline aligned with workflow/canonical-status-flow-v2
const CASE_STEPS = [
  'contacted',
  'appointment_scheduled',
  'profile_completion',
  'payment_confirmed',
  'submitted',
  'enrollment_paid',
] as const;

type CaseStep = typeof CASE_STEPS[number];

const MyApplicationTab: React.FC<MyApplicationTabProps> = ({ userId }) => {
  const [caseData, setCaseData] = useState<any>(null);
  const [submission, setSubmission] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useTranslation('dashboard');

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch case from the unified cases table using student_user_id
        const { data: caseRow } = await (supabase as any)
          .from('cases')
          .select('*')
          .eq('student_user_id', userId)
          .maybeSingle();

        if (caseRow) {
          setCaseData(caseRow);

          // Fetch submission and upcoming appointments in parallel
          const [subRes, apptRes] = await Promise.all([
            (supabase as any)
              .from('case_submissions')
              .select('*')
              .eq('case_id', caseRow.id)
              .maybeSingle(),
            (supabase as any)
              .from('appointments')
              .select('*')
              .eq('case_id', caseRow.id)
              .gte('scheduled_at', new Date().toISOString())
              .order('scheduled_at', { ascending: true })
              .limit(3),
          ]);

          setSubmission(subRes.data ?? null);
          setAppointments(apptRes.data ?? []);
        }
      } catch (err) {
        console.error('Error fetching application:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [userId]);

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">{t('application.loading', 'Loading...')}</div>;

  if (!caseData) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <FileCheck className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">{t('application.noApplication', 'No application yet')}</p>
          <p className="text-sm mt-1">{t('application.noApplicationDesc', 'Your application will appear here once it has been assigned.')}</p>
        </CardContent>
      </Card>
    );
  }

  const currentStepIndex = CASE_STEPS.indexOf(caseData.status as CaseStep);

  const stepLabels: Record<CaseStep, { en: string; ar: string }> = {
    contacted: { en: 'Contacted', ar: 'تم التواصل' },
    appointment_scheduled: { en: 'Appointment', ar: 'موعد' },
    profile_completion: { en: 'Profile Complete', ar: 'إكمال الملف' },
    payment_confirmed: { en: 'Payment', ar: 'الدفع' },
    submitted: { en: 'Submitted', ar: 'تم التقديم' },
    enrollment_paid: { en: 'Enrolled ✓', ar: 'مسجّل ✓' },
  };

  return (
    <div className="space-y-4">
      {/* Application Status */}
      <Card>
        <CardContent className="p-4 flex items-center gap-4">
          <div>
            <span className="text-xs text-muted-foreground">{t('application.currentStatus', 'Current Status')}</span>
            <div className="font-semibold text-primary capitalize mt-0.5">{caseData.status?.replace(/_/g, ' ')}</div>
          </div>
          <div className="ms-auto text-xs text-muted-foreground">
            {t('application.createdAt', 'Created')}: {format(new Date(caseData.created_at), 'dd/MM/yyyy')}
          </div>
        </CardContent>
      </Card>

      {/* Timeline Stepper */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{t('application.progress', 'Application Progress')}</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Desktop horizontal */}
          <div className="hidden sm:flex items-start justify-between relative">
            <div className="absolute top-3 left-3 right-3 h-0.5 bg-muted z-0" />
            <div
              className="absolute top-3 left-3 h-0.5 bg-green-500 z-0 transition-all duration-500"
              style={{ width: currentStepIndex >= 0 ? `${(currentStepIndex / (CASE_STEPS.length - 1)) * 100}%` : '0%' }}
            />
            {CASE_STEPS.map((step, i) => {
              const isCompleted = i < currentStepIndex;
              const isCurrent = i === currentStepIndex;
              const label = stepLabels[step].en;
              return (
                <div key={step} className="flex flex-col items-center z-10 flex-1">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold transition-all duration-300
                    ${isCompleted ? 'bg-green-500 border-green-500 text-white' : ''}
                    ${isCurrent ? 'bg-primary border-primary text-primary-foreground animate-pulse' : ''}
                    ${!isCompleted && !isCurrent ? 'bg-background border-muted-foreground/30 text-muted-foreground' : ''}
                  `}>
                    {isCompleted ? '✓' : i + 1}
                  </div>
                  <span className={`text-[9px] mt-1 text-center leading-tight max-w-[70px]
                    ${isCurrent ? 'text-primary font-semibold' : isCompleted ? 'text-green-600 font-medium' : 'text-muted-foreground'}
                  `}>{label}</span>
                </div>
              );
            })}
          </div>

          {/* Mobile vertical */}
          <div className="sm:hidden space-y-1">
            {CASE_STEPS.map((step, i) => {
              const isCompleted = i < currentStepIndex;
              const isCurrent = i === currentStepIndex;
              const label = stepLabels[step].en;
              return (
                <div key={step} className="flex items-center gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[9px] font-bold
                      ${isCompleted ? 'bg-green-500 border-green-500 text-white' : ''}
                      ${isCurrent ? 'bg-primary border-primary text-primary-foreground animate-pulse' : ''}
                      ${!isCompleted && !isCurrent ? 'bg-background border-muted-foreground/30 text-muted-foreground' : ''}
                    `}>
                      {isCompleted ? '✓' : i + 1}
                    </div>
                    {i < CASE_STEPS.length - 1 && (
                      <div className={`w-0.5 h-4 ${i < currentStepIndex ? 'bg-green-500' : 'bg-muted'}`} />
                    )}
                  </div>
                  <span className={`text-xs ${isCurrent ? 'text-primary font-semibold' : isCompleted ? 'text-green-600' : 'text-muted-foreground'}`}>{label}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Submission / Program Details */}
      {submission && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('application.programDetails', 'Program Details')}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {submission.service_fee > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('application.serviceFee', 'Service Fee')}</span>
                <span className="font-medium">{submission.service_fee.toLocaleString()} ILS</span>
              </div>
            )}
            {submission.program_start_date && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('application.programStart', 'Program Start')}</span>
                <span>{submission.program_start_date}</span>
              </div>
            )}
            {submission.program_end_date && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('application.programEnd', 'Program End')}</span>
                <span>{submission.program_end_date}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('application.paymentStatus', 'Payment')}</span>
              <span className={submission.payment_confirmed ? 'text-green-600 font-medium' : 'text-amber-600'}>
                {submission.payment_confirmed ? t('application.paid', 'Confirmed') : t('application.pending', 'Pending')}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming Appointments */}
      {appointments.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{t('application.upcomingAppointments', 'Upcoming Appointments')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {appointments.map(apt => (
              <div key={apt.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-50">
                    <Calendar className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{format(new Date(apt.scheduled_at), 'dd/MM/yyyy HH:mm')}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{apt.duration_minutes} {t('application.minutes', 'min')}</span>
                    </div>
                  </div>
                </div>
                <Badge variant="secondary">{t('application.scheduled', 'Scheduled')}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MyApplicationTab;
