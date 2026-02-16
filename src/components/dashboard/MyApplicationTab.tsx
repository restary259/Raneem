
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, School, Home, FileCheck, Calendar, Clock, Copy, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';

interface MyApplicationTabProps {
  userId: string;
}

// Simplified 6-stage funnel aligned with admin CasesManagement
const CASE_STEPS = [
  'assigned',
  'contacted',
  'paid',
  'ready_to_apply',
  'visa_stage',
  'completed',
] as const;

// Map legacy statuses to the simplified funnel for display
const LEGACY_STATUS_MAP: Record<string, string> = {
  appointment: 'contacted',
  closed: 'completed',
  registration_submitted: 'ready_to_apply',
  settled: 'completed',
};

const MyApplicationTab: React.FC<MyApplicationTabProps> = ({ userId }) => {
  const [studentCase, setStudentCase] = useState<any>(null);
  const [casePayments, setCasePayments] = useState<any[]>([]);
  const [leadData, setLeadData] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const { t } = useTranslation('dashboard');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: caseData } = await (supabase as any)
          .from('student_cases')
          .select('*')
          .eq('student_profile_id', userId)
          .maybeSingle();

        if (caseData) {
          setStudentCase(caseData);

          // Fetch payments, lead, and appointments in parallel
          const [paymentsRes, leadRes, appointmentsRes] = await Promise.all([
            (supabase as any)
              .from('case_payments')
              .select('*')
              .eq('case_id', caseData.id)
              .order('created_at', { ascending: true }),
            (supabase as any)
              .from('leads')
              .select('ref_code, full_name, eligibility_score')
              .eq('id', caseData.lead_id)
              .maybeSingle(),
            (supabase as any)
              .from('appointments')
              .select('*')
              .eq('case_id', caseData.id)
              .gte('scheduled_at', new Date().toISOString())
              .order('scheduled_at', { ascending: true })
              .limit(3),
          ]);

          setCasePayments(paymentsRes.data || []);
          setLeadData(leadRes.data);
          setAppointments(appointmentsRes.data || []);
        }
      } catch (err) {
        console.error('Error fetching application:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [userId]);

  const handleCopyRef = () => {
    if (leadData?.ref_code) {
      navigator.clipboard.writeText(leadData.ref_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">{t('application.loading')}</div>;

  if (!studentCase) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <FileCheck className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">{t('application.noApplication')}</p>
          <p className="text-sm mt-1">{t('application.noApplicationDesc')}</p>
        </CardContent>
      </Card>
    );
  }

  const mappedStatus = LEGACY_STATUS_MAP[studentCase.case_status] || studentCase.case_status;
  const currentStepIndex = CASE_STEPS.indexOf(mappedStatus as typeof CASE_STEPS[number]);

  return (
    <div className="space-y-4">
      {/* Ref Code & Score Card */}
      {leadData && (
        <Card>
          <CardContent className="p-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{t('application.refCode')}</span>
              <span className="font-mono text-lg font-bold text-primary">{leadData.ref_code || '—'}</span>
              {leadData.ref_code && (
                <button onClick={handleCopyRef} className="p-1 rounded hover:bg-muted transition-colors">
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
                </button>
              )}
            </div>
            {leadData.eligibility_score != null && (
              <Badge variant={leadData.eligibility_score >= 70 ? 'default' : 'secondary'}>
                {t('application.score')}: {leadData.eligibility_score}
              </Badge>
            )}
            <div className="text-xs text-muted-foreground ms-auto">
              {t('application.createdAt')}: {format(new Date(studentCase.created_at), 'dd/MM/yyyy')}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timeline Stepper */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{t('application.progress')}</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Desktop horizontal */}
          <div className="hidden sm:flex items-start justify-between relative">
            {/* Connecting line */}
            <div className="absolute top-3 left-3 right-3 h-0.5 bg-muted z-0" />
            <div
              className="absolute top-3 left-3 h-0.5 bg-green-500 z-0 transition-all duration-500"
              style={{ width: currentStepIndex >= 0 ? `${(currentStepIndex / (CASE_STEPS.length - 1)) * 100}%` : '0%' }}
            />
            {CASE_STEPS.map((step, i) => {
              const isCompleted = i < currentStepIndex;
              const isCurrent = i === currentStepIndex;
              return (
                <div key={step} className="flex flex-col items-center z-10 flex-1">
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold transition-all duration-300
                      ${isCompleted ? 'bg-green-500 border-green-500 text-white' : ''}
                      ${isCurrent ? 'bg-primary border-primary text-primary-foreground animate-pulse' : ''}
                      ${!isCompleted && !isCurrent ? 'bg-background border-muted-foreground/30 text-muted-foreground' : ''}
                    `}
                  >
                    {isCompleted ? '✓' : i + 1}
                  </div>
                  <span className={`text-[9px] mt-1 text-center leading-tight max-w-[70px]
                    ${isCurrent ? 'text-primary font-semibold' : isCompleted ? 'text-green-600 font-medium' : 'text-muted-foreground'}
                  `}>
                    {t(`application.steps.${step}`)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Mobile vertical */}
          <div className="sm:hidden space-y-1">
            {CASE_STEPS.map((step, i) => {
              const isCompleted = i < currentStepIndex;
              const isCurrent = i === currentStepIndex;
              return (
                <div key={step} className="flex items-center gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[9px] font-bold
                        ${isCompleted ? 'bg-green-500 border-green-500 text-white' : ''}
                        ${isCurrent ? 'bg-primary border-primary text-primary-foreground animate-pulse' : ''}
                        ${!isCompleted && !isCurrent ? 'bg-background border-muted-foreground/30 text-muted-foreground' : ''}
                      `}
                    >
                      {isCompleted ? '✓' : i + 1}
                    </div>
                    {i < CASE_STEPS.length - 1 && (
                      <div className={`w-0.5 h-4 ${i < currentStepIndex ? 'bg-green-500' : 'bg-muted'}`} />
                    )}
                  </div>
                  <span className={`text-xs ${isCurrent ? 'text-primary font-semibold' : isCompleted ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {t(`application.steps.${step}`)}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Details */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100"><MapPin className="h-5 w-5 text-blue-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">{t('application.city')}</p>
              <p className="font-semibold text-sm">{studentCase.selected_city || t('application.notSet')}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100"><School className="h-5 w-5 text-purple-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">{t('application.school')}</p>
              <p className="font-semibold text-sm">{studentCase.selected_school || t('application.notSet')}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100"><Home className="h-5 w-5 text-amber-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">{t('application.accommodation')}</p>
              <p className="font-semibold text-sm">{studentCase.accommodation_status || t('application.notSet')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Appointments */}
      {appointments.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{t('application.upcomingAppointments')}</CardTitle>
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
                      <span>{t('application.duration', { minutes: apt.duration_minutes })}</span>
                      {apt.location && <span>• {apt.location}</span>}
                    </div>
                  </div>
                </div>
                <Badge variant={apt.status === 'completed' ? 'default' : 'secondary'}>{apt.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Case Payments */}
      {casePayments.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{t('application.payments')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {casePayments.map(p => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div>
                  <p className="text-sm font-medium">
                    {t(`application.paymentTypes.${p.payment_type}`, { defaultValue: p.payment_type })}
                  </p>
                  <p className="text-xs text-muted-foreground">{p.amount} €</p>
                </div>
                <Badge variant={p.paid_status === 'paid' ? 'default' : 'secondary'}>
                  {p.paid_status === 'paid' ? t('application.paid') : t('application.pending')}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MyApplicationTab;
