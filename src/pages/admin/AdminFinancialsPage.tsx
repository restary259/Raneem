import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, TrendingUp, Users, DollarSign, Percent } from 'lucide-react';

const AdminFinancialsPage = () => {
  const { t } = useTranslation('dashboard');
  const { toast } = useToast();

  const [data, setData] = useState({
    totalRevenue: 0,
    serviceFees: 0,
    translationFees: 0,
    partnerCommission: 0,
    partnerCommissionRate: 500,
    enrolledCount: 0,
    referralDiscounts: 0,
  });
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [subRes, settingsRes, casesRes] = await Promise.all([
        supabase.from('case_submissions').select('service_fee, translation_fee, enrollment_paid_at, case_id').not('enrollment_paid_at', 'is', null),
        supabase.from('platform_settings').select('partner_commission_rate').limit(1).single(),
        supabase.from('cases').select('id, discount_amount, partner_id, status').eq('status', 'enrollment_paid'),
      ]);

      const subs = subRes.data || [];
      const cases = casesRes.data || [];

      const serviceFees = subs.reduce((s, r) => s + (r.service_fee || 0), 0);
      const translationFees = subs.reduce((s, r) => s + (r.translation_fee || 0), 0);
      const enrolledCount = cases.length;
      const partnerCases = cases.filter(c => !!c.partner_id).length;
      const rate = settingsRes.data?.partner_commission_rate || 500;
      const referralDiscounts = cases.reduce((s, c) => s + (c.discount_amount || 0), 0);

      setData({
        totalRevenue: serviceFees + translationFees,
        serviceFees,
        translationFees,
        partnerCommission: partnerCases * rate,
        partnerCommissionRate: rate,
        enrolledCount,
        referralDiscounts,
      });
      setSubmissions(subs);
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fmt = (n: number) => n.toLocaleString('en-US');

  const kpis = [
    { label: t('admin.financials.kpiTotalRevenue'), value: `${fmt(data.totalRevenue)} ILS`, icon: TrendingUp, color: 'text-green-600 bg-green-600/10' },
    { label: t('admin.financials.kpiServiceFees'), value: `${fmt(data.serviceFees)} ILS`, icon: DollarSign, color: 'text-primary bg-primary/10' },
    { label: t('admin.financials.kpiTranslationFees'), value: `${fmt(data.translationFees)} ILS`, icon: DollarSign, color: 'text-blue-600 bg-blue-600/10' },
    { label: t('admin.financials.kpiPartnerCommission'), value: `${fmt(data.partnerCommission)} ILS`, icon: Percent, color: 'text-orange-600 bg-orange-600/10' },
    { label: t('admin.financials.kpiEnrolledStudents'), value: data.enrolledCount.toLocaleString('en-US'), icon: Users, color: 'text-teal-600 bg-teal-600/10' },
    { label: t('admin.financials.kpiReferralDiscounts'), value: `${fmt(data.referralDiscounts)} ILS`, icon: Percent, color: 'text-muted-foreground bg-muted' },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('admin.financials.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('admin.financials.partnerCommissionRateInfo', { rate: data.partnerCommissionRate })}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {kpis.map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="p-5">
              <div className={`inline-flex p-2 rounded-lg ${kpi.color.split(' ')[1]} mb-3`}>
                <kpi.icon className={`h-5 w-5 ${kpi.color.split(' ')[0]}`} />
              </div>
              <p className="text-xl font-bold text-foreground truncate min-w-0">{loading ? '–' : kpi.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent enrolled cases */}
      <Card>
        <CardHeader><CardTitle className="text-base">{t('admin.financials.recentEnrolled')}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {submissions.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">{t('admin.financials.noData')}</p>
          ) : (
            <div className="divide-y divide-border">
              {submissions.slice(0, 10).map(s => (
                <div key={s.case_id} className="flex items-center justify-between p-4">
                  <p className="text-xs text-muted-foreground">{new Date(s.enrollment_paid_at).toLocaleDateString('en-US')}</p>
                  <div className="text-end">
                    <p className="text-sm font-medium text-foreground">{((s.service_fee || 0) + (s.translation_fee || 0)).toLocaleString('en-US')} ILS</p>
                    <p className="text-xs text-muted-foreground">{(s.service_fee || 0).toLocaleString('en-US')} + {(s.translation_fee || 0).toLocaleString('en-US')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminFinancialsPage;
