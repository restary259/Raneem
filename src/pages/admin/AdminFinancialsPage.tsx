import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, TrendingUp, Users, DollarSign, Percent, Wallet, HandCoins, Clock } from 'lucide-react';
import PayoutsManagement from '@/components/admin/PayoutsManagement';
import PartnerPayoutsPanel from '@/components/admin/PartnerPayoutsPanel';

const OverviewTab = () => {
  const { t } = useTranslation('dashboard');
  const { toast } = useToast();

  const [data, setData] = useState({
    serviceFees: 0,
    partnerCommissionPending: 0,
    partnerCommissionPaid: 0,
    platformNetRevenue: 0,
    enrolledCount: 0,
    referralDiscounts: 0,
  });
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch in parallel: case_submissions for service fees,
      // rewards for actual partner commission totals (not projection),
      // and cases for platform net + enrolled count
      const [subRes, rewardsRes, casesRes] = await Promise.all([
        supabase
          .from('case_submissions')
          .select('service_fee, enrollment_paid_at, case_id')
          .not('enrollment_paid_at', 'is', null),
        (supabase as any)
          .from('rewards')
          .select('amount, status, admin_notes')
          .like('admin_notes', 'Partner commission from case%'),
        supabase
          .from('cases')
          .select('id, discount_amount, platform_revenue_ils, status')
          .eq('status', 'enrollment_paid'),
      ]);

      const subs = subRes.data || [];
      const rewards: any[] = rewardsRes.data || [];
      const cases = casesRes.data || [];

      const serviceFees = subs.reduce((s: number, r: any) => s + (r.service_fee || 0), 0);
      const enrolledCount = cases.length;
      const referralDiscounts = cases.reduce((s: number, c: any) => s + (c.discount_amount || 0), 0);
      const platformNetRevenue = cases.reduce((s: number, c: any) => s + (c.platform_revenue_ils || 0), 0);

      // Real partner commission totals from rewards table (not projection)
      const partnerCommissionPending = rewards
        .filter((r: any) => r.status === 'pending' || r.status === 'approved')
        .reduce((s: number, r: any) => s + (r.amount || 0), 0);
      const partnerCommissionPaid = rewards
        .filter((r: any) => r.status === 'paid')
        .reduce((s: number, r: any) => s + (r.amount || 0), 0);

      setData({
        serviceFees,
        partnerCommissionPending,
        partnerCommissionPaid,
        platformNetRevenue,
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
    {
      label: t('admin.financials.kpiServiceFees'),
      value: `${fmt(data.serviceFees)} ILS`,
      icon: DollarSign,
      color: 'text-primary bg-primary/10',
    },
    {
      label: t('admin.financials.kpiAdminNet'),
      value: `${fmt(data.platformNetRevenue)} ILS`,
      icon: TrendingUp,
      color: 'text-green-600 bg-green-600/10',
    },
    {
      label: t('admin.financials.kpiPartnerPending'),
      value: `${fmt(data.partnerCommissionPending)} ILS`,
      icon: Clock,
      color: 'text-amber-600 bg-amber-600/10',
    },
    {
      label: t('admin.financials.kpiPartnerPaid'),
      value: `${fmt(data.partnerCommissionPaid)} ILS`,
      icon: Percent,
      color: 'text-orange-600 bg-orange-600/10',
    },
    {
      label: t('admin.financials.kpiEnrolledStudents'),
      value: data.enrolledCount.toLocaleString('en-US'),
      icon: Users,
      color: 'text-teal-600 bg-teal-600/10',
    },
    {
      label: t('admin.financials.kpiReferralDiscounts'),
      value: `${fmt(data.referralDiscounts)} ILS`,
      icon: Percent,
      color: 'text-muted-foreground bg-muted',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t('admin.financials.partnerCommissionRateInfo', { rate: '—' })}
        </p>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {kpis.map(kpi => (
          <Card key={kpi.label}>
            <CardContent className="p-5">
              <div className={`inline-flex p-2 rounded-lg ${kpi.color.split(' ')[1]} mb-3`}>
                <kpi.icon className={`h-5 w-5 ${kpi.color.split(' ')[0]}`} />
              </div>
              <p className="text-xl font-bold text-foreground truncate min-w-0">
                {loading ? '–' : kpi.value}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('admin.financials.recentEnrolled')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {submissions.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              {t('admin.financials.noData')}
            </p>
          ) : (
            <div className="divide-y divide-border">
              {submissions.slice(0, 10).map((s: any) => (
                <div key={s.case_id} className="flex items-center justify-between p-4">
                  <p className="text-xs text-muted-foreground">
                    {new Date(s.enrollment_paid_at).toLocaleDateString('en-US')}
                  </p>
                  <div className="text-end">
                    <p className="text-sm font-medium text-foreground">
                      {(s.service_fee || 0).toLocaleString('en-US')} ILS
                    </p>
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

const AdminFinancialsPage = () => {
  const { t } = useTranslation('dashboard');

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('admin.financials.title')}</h1>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="mb-6">
          <TabsTrigger value="overview" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            {t('admin.financials.tabOverview')}
          </TabsTrigger>
          <TabsTrigger value="agent-payouts" className="gap-2">
            <Wallet className="h-4 w-4" />
            {t('admin.financials.tabAgentPayouts')}
          </TabsTrigger>
          <TabsTrigger value="partner-payouts" className="gap-2">
            <HandCoins className="h-4 w-4" />
            {t('admin.financials.tabPartnerPayouts')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab />
        </TabsContent>

        <TabsContent value="agent-payouts">
          <PayoutsManagement />
        </TabsContent>

        <TabsContent value="partner-payouts">
          <PartnerPayoutsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminFinancialsPage;
