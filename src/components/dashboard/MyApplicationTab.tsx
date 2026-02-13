
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, School, Home, FileCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface MyApplicationTabProps {
  userId: string;
}

const CASE_STEPS = [
  { value: 'assigned', label: 'معيّن', labelEn: 'Assigned' },
  { value: 'contacted', label: 'تم التواصل', labelEn: 'Contacted' },
  { value: 'appointment', label: 'موعد', labelEn: 'Appointment' },
  { value: 'closed', label: 'مغلق', labelEn: 'Closed' },
  { value: 'paid', label: 'مدفوع', labelEn: 'Paid' },
  { value: 'registration_submitted', label: 'تم تقديم التسجيل', labelEn: 'Registration Submitted' },
  { value: 'visa_stage', label: 'مرحلة الفيزا', labelEn: 'Visa Stage' },
  { value: 'completed', label: 'مكتمل', labelEn: 'Completed' },
];

const MyApplicationTab: React.FC<MyApplicationTabProps> = ({ userId }) => {
  const [studentCase, setStudentCase] = useState<any>(null);
  const [casePayments, setCasePayments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { t, i18n } = useTranslation('dashboard');
  const isAr = i18n.language === 'ar';

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
          const { data: payments } = await (supabase as any)
            .from('case_payments')
            .select('*')
            .eq('case_id', caseData.id)
            .order('created_at', { ascending: true });
          setCasePayments(payments || []);
        }
      } catch (err) {
        console.error('Error fetching application:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [userId]);

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">{isAr ? 'جار التحميل...' : 'Loading...'}</div>;

  if (!studentCase) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <FileCheck className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="font-medium">{isAr ? 'لا يوجد ملف تقديم بعد' : 'No application found yet'}</p>
          <p className="text-sm mt-1">{isAr ? 'سيظهر ملفك هنا بعد تسجيلك لدينا' : 'Your application will appear here after registration'}</p>
        </CardContent>
      </Card>
    );
  }

  const currentStepIndex = CASE_STEPS.findIndex(s => s.value === studentCase.case_status);
  const progressPercent = currentStepIndex >= 0 ? Math.round(((currentStepIndex + 1) / CASE_STEPS.length) * 100) : 0;
  const currentStepLabel = CASE_STEPS[currentStepIndex];

  return (
    <div className="space-y-4">
      {/* Progress */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{isAr ? 'تقدم الطلب' : 'Application Progress'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <Badge variant="secondary">{currentStepLabel ? (isAr ? currentStepLabel.label : currentStepLabel.labelEn) : studentCase.case_status}</Badge>
            <span className="text-muted-foreground font-medium">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-3" />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            {CASE_STEPS.map((step, i) => (
              <span key={step.value} className={i <= currentStepIndex ? 'text-primary font-semibold' : ''}>
                {isAr ? step.label : step.labelEn}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Details */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100"><MapPin className="h-5 w-5 text-blue-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">{isAr ? 'المدينة' : 'City'}</p>
              <p className="font-semibold text-sm">{studentCase.selected_city || (isAr ? 'لم يُحدد' : 'Not set')}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100"><School className="h-5 w-5 text-purple-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">{isAr ? 'المدرسة' : 'School'}</p>
              <p className="font-semibold text-sm">{studentCase.selected_school || (isAr ? 'لم يُحدد' : 'Not set')}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100"><Home className="h-5 w-5 text-amber-600" /></div>
            <div>
              <p className="text-xs text-muted-foreground">{isAr ? 'السكن' : 'Accommodation'}</p>
              <p className="font-semibold text-sm">{studentCase.accommodation_status || (isAr ? 'لم يُحدد' : 'Not set')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Case Payments */}
      {casePayments.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{isAr ? 'المدفوعات' : 'Payments'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {casePayments.map(p => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div>
                  <p className="text-sm font-medium">
                    {{ service_fee: isAr ? 'رسوم الخدمة' : 'Service Fee', school_payment: isAr ? 'دفعة المدرسة' : 'School Payment', translation: isAr ? 'ترجمة' : 'Translation' }[p.payment_type] || p.payment_type}
                  </p>
                  <p className="text-xs text-muted-foreground">{p.amount} €</p>
                </div>
                <Badge variant={p.paid_status === 'paid' ? 'default' : 'secondary'}>
                  {p.paid_status === 'paid' ? (isAr ? 'مدفوع' : 'Paid') : (isAr ? 'معلق' : 'Pending')}
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
