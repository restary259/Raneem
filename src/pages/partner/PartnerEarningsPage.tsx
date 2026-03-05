import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, Award, Info } from 'lucide-react';
import DashboardLoading from '@/components/dashboard/DashboardLoading';
import { useDirection } from '@/hooks/useDirection';

const QUALIFYING_STATUSES = ['submitted', 'enrollment_paid'];

export default function PartnerEarningsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [cases, setCases] = useState<any[]>([]);
  const [commissionRate, setCommissionRate] = useState<number>(500);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation('dashboard');
  const { dir } = useDirection();
  const isAr = i18n.language === 'ar';

  const load = useCallback(async (uid: string) => {
    const [casesRes, settingsRes] = await Promise.all([
      (supabase as any)
        .from('cases')
        .select('id,full_name,status,created_at')
        .eq('partner_id', uid)
        .order('created_at', { ascending: false }),
      (supabase as any)
        .from('platform_settings')
        .select('partner_commission_rate')
        .limit(1)
        .maybeSingle(),
    ]);

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

  const qualifyingCases = cases.filter(c => QUALIFYING_STATUSES.includes(c.status));
  const totalEarned = qualifyingCases.length * commissionRate;
  const paidCases = cases.filter(c => c.status === 'enrollment_paid');
  const submittedCases = cases.filter(c => c.status === 'submitted');

  const statusLabel = (s: string) => {
    const labels: Record<string, string> = {
      submitted: t('partner.status.submitted', 'Submitted'),
      enrollment_paid: t('partner.status.paid', 'Enrolled & Paid ✅'),
    };
    return labels[s] || s;
  };

  const statusColor: Record<string, string> = {
    submitted: 'bg-cyan-100 text-cyan-800',
    enrollment_paid: 'bg-green-100 text-green-800',
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6" dir={dir}>
      <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
        <DollarSign className="h-6 w-6 text-primary" />
        {t('partner.earningsTitle', 'My Earnings')}
      </h1>

      {/* Commission Rate Info */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/50 border border-border">
        <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground">
          {t('partner.commission.rateInfo', 'You earn ₪{{rate}} per student who submits or completes enrollment.').toString().replace('{{rate}}', commissionRate.toLocaleString())}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Award className="h-4 w-4 text-green-600" />
              <span className="text-xs">{t('partner.earnings.totalEarned', 'Total Earned')}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">₪{totalEarned.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="h-4 w-4 text-cyan-600" />
              <span className="text-xs">{t('partner.earnings.submitted', 'Submitted')}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{submittedCases.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              <span className="text-xs">{t('partner.earnings.enrolled', 'Enrolled')}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{paidCases.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Per-case Commission Breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('partner.earnings.breakdown', 'Commission Breakdown')}</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          {qualifyingCases.length === 0 && (
            <p className="text-center text-muted-foreground py-6 text-sm">
              {t('partner.earnings.noQualifying', 'No students have reached submission stage yet.')}
            </p>
          )}
          {qualifyingCases.map((c) => (
            <div key={c.id} className="py-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{c.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(c.created_at).toLocaleDateString(isAr ? 'ar' : 'en-GB')}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-bold text-foreground">₪{commissionRate.toLocaleString()}</span>
                <Badge className={`text-xs ${statusColor[c.status] || 'bg-muted text-muted-foreground'}`}>
                  {statusLabel(c.status)}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* All referred cases (non-qualifying) */}
      {cases.filter(c => !QUALIFYING_STATUSES.includes(c.status)).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-muted-foreground">
              {t('partner.earnings.pending', 'In Pipeline (not yet qualifying)')}
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {cases.filter(c => !QUALIFYING_STATUSES.includes(c.status)).map((c) => (
              <div key={c.id} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{c.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString(isAr ? 'ar' : 'en-GB')}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {String(t(`case.status.${c.status}`, c.status))}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
