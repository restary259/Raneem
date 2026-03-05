import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, DollarSign, TrendingUp, Award, CheckCircle, Calendar, FileCheck } from 'lucide-react';
import DashboardLoading from '@/components/dashboard/DashboardLoading';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { useDirection } from '@/hooks/useDirection';

export default function PartnerOverviewPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [cases, setCases] = useState<any[]>([]);
  const [commissionRate, setCommissionRate] = useState<number>(500);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation('dashboard');
  const { dir } = useDirection();
  const isAr = i18n.language === 'ar';

  const load = useCallback(async (uid: string) => {
    const [profRes, casesRes, settingsRes] = await Promise.all([
      (supabase as any).from('profiles').select('full_name,email').eq('id', uid).maybeSingle(),
      (supabase as any).from('cases').select('id,status,created_at').order('created_at', { ascending: false }),
      (supabase as any).from('platform_settings').select('partner_commission_rate').limit(1).maybeSingle(),
    ]);

    if (profRes.data) setProfile(profRes.data);
    setCases(casesRes.data || []);
    if (settingsRes.data?.partner_commission_rate) {
      setCommissionRate(Number(settingsRes.data.partner_commission_rate));
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) { navigate('/student-auth'); return; }
      setUserId(session.user.id);
      load(session.user.id);
    });
  }, [navigate, load]);

  if (!userId || isLoading) return <DashboardLoading />;

  const total = cases.length;
  const contacted = cases.filter(c => !['new'].includes(c.status)).length;
  const withAppointment = cases.filter(c => ['appointment_scheduled', 'profile_completion', 'payment_confirmed', 'submitted', 'enrollment_paid'].includes(c.status)).length;
  const profileComplete = cases.filter(c => ['profile_completion', 'payment_confirmed', 'submitted', 'enrollment_paid'].includes(c.status)).length;
  const paid = cases.filter(c => ['payment_confirmed', 'submitted', 'enrollment_paid'].includes(c.status)).length;
  const enrolled = cases.filter(c => c.status === 'enrollment_paid').length;

  const kpis = [
    { label: isAr ? 'إجمالي التسجيلات' : 'Total Registrations', value: total, icon: <Users className="h-5 w-5" />, color: 'text-blue-600 bg-blue-50' },
    { label: isAr ? 'تم التواصل' : 'Contacted', value: contacted, icon: <CheckCircle className="h-5 w-5" />, color: 'text-sky-600 bg-sky-50' },
    { label: isAr ? 'لديهم موعد' : 'With Appointment', value: withAppointment, icon: <Calendar className="h-5 w-5" />, color: 'text-purple-600 bg-purple-50' },
    { label: isAr ? 'ملف مكتمل' : 'Profile Complete', value: profileComplete, icon: <FileCheck className="h-5 w-5" />, color: 'text-yellow-600 bg-yellow-50' },
    { label: isAr ? 'دفعوا' : 'Paid', value: paid, icon: <DollarSign className="h-5 w-5" />, color: 'text-emerald-600 bg-emerald-50' },
    { label: isAr ? 'مسجلون' : 'Enrolled', value: enrolled, icon: <Award className="h-5 w-5" />, color: 'text-green-600 bg-green-50' },
  ];

  const funnelData = [
    { name: isAr ? 'تسجيل' : 'Registered', value: total },
    { name: isAr ? 'تواصل' : 'Contacted', value: contacted },
    { name: isAr ? 'موعد' : 'Appointment', value: withAppointment },
    { name: isAr ? 'ملف مكتمل' : 'Profile Done', value: profileComplete },
    { name: isAr ? 'مدفوع' : 'Paid', value: paid },
    { name: isAr ? 'مسجل' : 'Enrolled', value: enrolled },
  ];

  const COLORS = ['#3b82f6', '#0ea5e9', '#8b5cf6', '#eab308', '#10b981', '#22c55e'];

  const projectedEarnings = enrolled * commissionRate;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" dir={dir}>
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {isAr ? 'مرحبًا' : 'Welcome back'}{profile?.full_name ? `, ${profile.full_name}` : ''}! 👋
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {isAr ? 'إحصائيات مباشرة للطلاب المسجلين عبر الموقع' : 'Live analytics for students registered through the website'}
        </p>
      </div>

      {/* Projected Earnings Banner */}
      <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {isAr ? 'الأرباح المتوقعة' : 'Projected Earnings'}
          </p>
          <p className="text-xs text-muted-foreground">
            {isAr
              ? `${enrolled} طالب مسجل × ${commissionRate} ILS`
              : `${enrolled} enrolled students × ${commissionRate} ILS`}
          </p>
        </div>
        <p className="text-3xl font-bold text-primary">₪{projectedEarnings.toLocaleString()}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-3">
              <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg mb-2 ${kpi.color}`}>
                {kpi.icon}
              </div>
              <p className="text-xl font-bold text-foreground">{kpi.value}</p>
              <p className="text-xs text-muted-foreground leading-tight mt-0.5">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Funnel Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {isAr ? 'قمع التحويل' : 'Conversion Funnel'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={funnelData} layout="vertical">
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: any) => [v, isAr ? 'طالب' : 'Students']} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                {funnelData.map((_, idx) => (
                  <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Conversion Rate */}
      {total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{isAr ? 'معدل التحويل للدفع' : 'Registration → Paid'}</p>
              <p className="text-2xl font-bold text-foreground">{Math.round((paid / total) * 100)}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{isAr ? 'معدل التسجيل الكامل' : 'Registration → Enrolled'}</p>
              <p className="text-2xl font-bold text-foreground">{Math.round((enrolled / total) * 100)}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{isAr ? 'عمولة لكل طالب' : 'Commission Per Student'}</p>
              <p className="text-2xl font-bold text-foreground">₪{commissionRate.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
