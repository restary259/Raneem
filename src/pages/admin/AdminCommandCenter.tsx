import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Users, ClipboardCheck, CheckCircle2, Activity, RefreshCw } from 'lucide-react';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { useNavigate } from 'react-router-dom';

interface CaseCounts {
  total: number;
  submitted: number;
  enrollment_paid: number;
  forgotten: number;
  sla_breaches: number;
}

interface ActivityEntry {
  id: string;
  actor_name: string | null;
  action: string;
  entity_type: string;
  created_at: string;
  metadata: any;
}

const AdminCommandCenter = () => {
  const { t, i18n } = useTranslation('dashboard');
  const { toast } = useToast();
  const navigate = useNavigate();
  const isRtl = i18n.language === 'ar';

  const [counts, setCounts] = useState<CaseCounts>({ total: 0, submitted: 0, enrollment_paid: 0, forgotten: 0, sla_breaches: 0 });
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [casesRes, activityRes, forgottenRes] = await Promise.all([
        supabase.from('cases').select('status, last_activity_at, created_at'),
        supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(10),
        supabase.rpc('get_forgotten_cases'),
      ]);

      if (casesRes.error) throw casesRes.error;
      const cases = casesRes.data || [];

      // SLA breach detection
      const slaBreaches = cases.filter(c => {
        const days = Math.floor((Date.now() - new Date(c.last_activity_at).getTime()) / 86400000);
        return (
          (c.status === 'new' && days >= 3) ||
          (c.status === 'contacted' && days >= 5) ||
          (c.status === 'appointment_scheduled' && days >= 14) ||
          (c.status === 'profile_completion' && days >= 7)
        );
      });

      setCounts({
        total: cases.filter(c => !['enrollment_paid', 'forgotten'].includes(c.status)).length,
        submitted: cases.filter(c => c.status === 'submitted').length,
        enrollment_paid: cases.filter(c => c.status === 'enrollment_paid').length,
        forgotten: (forgottenRes.data || []).length,
        sla_breaches: slaBreaches.length,
      });

      setActivity(activityRes.data || []);
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useRealtimeSubscription('cases', fetchData, true);
  useRealtimeSubscription('activity_log', fetchData, true);

  const kpis = [
    {
      label: t('admin.commandCenter.activeCases', 'Active Cases'),
      value: counts.total,
      icon: Users,
      color: 'text-primary',
      bg: 'bg-primary/10',
      onClick: () => navigate('/admin/pipeline'),
    },
    {
      label: t('admin.commandCenter.submitted', 'Submitted This Month'),
      value: counts.submitted,
      icon: ClipboardCheck,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      onClick: () => navigate('/admin/submissions'),
    },
    {
      label: t('admin.commandCenter.enrolled', 'Enrolled'),
      value: counts.enrollment_paid,
      icon: CheckCircle2,
      color: 'text-green-600',
      bg: 'bg-green-600/10',
      onClick: () => navigate('/admin/submissions'),
    },
    {
      label: t('admin.commandCenter.forgotten', 'Forgotten Cases'),
      value: counts.forgotten,
      icon: AlertTriangle,
      color: counts.forgotten > 0 ? 'text-destructive' : 'text-muted-foreground',
      bg: counts.forgotten > 0 ? 'bg-destructive/10' : 'bg-muted',
      onClick: () => navigate('/admin/pipeline'),
    },
  ];

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return isRtl
      ? d.toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' })
      : d.toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('admin.commandCenter.title', 'Command Center')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('admin.commandCenter.subtitle', 'Real-time overview of all activity')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          {t('common.refresh', 'Refresh')}
        </Button>
      </div>

      {/* Forgotten Cases Alert */}
      {counts.forgotten > 0 && (
        <div
          className="flex items-center gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/5 cursor-pointer hover:bg-destructive/10 transition-colors"
          onClick={() => navigate('/admin/pipeline')}
        >
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <p className="text-sm text-destructive font-medium">
            {isRtl
              ? `⚠️ يوجد ${counts.forgotten} حالة منسية — انقر لعرضها في خط الأنابيب`
              : `⚠️ ${counts.forgotten} forgotten case${counts.forgotten > 1 ? 's' : ''} require attention — click to view in pipeline`}
          </p>
        </div>
      )}

      {/* KPI Tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card
            key={kpi.label}
            className="cursor-pointer hover:shadow-md transition-shadow border border-border"
            onClick={kpi.onClick}
          >
            <CardContent className="p-5">
              <div className={`inline-flex p-2 rounded-lg ${kpi.bg} mb-3`}>
                <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
              </div>
              <p className="text-3xl font-bold text-foreground">{loading ? '–' : kpi.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            {t('admin.commandCenter.recentActivity', 'Recent Activity')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {t('admin.commandCenter.noActivity', 'No recent activity')}
            </p>
          ) : (
            <div className="space-y-3">
              {activity.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
                  <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">
                      <span className="font-medium">{entry.actor_name || t('admin.commandCenter.system', 'System')}</span>
                      {' — '}
                      <span className="text-muted-foreground">{entry.action}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatTime(entry.created_at)}</p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">{entry.entity_type}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: t('admin.commandCenter.viewPipeline', 'View Pipeline'), path: '/admin/pipeline' },
          { label: t('admin.commandCenter.viewSubmissions', 'Submissions'), path: '/admin/submissions' },
          { label: t('admin.commandCenter.manageTeam', 'Manage Team'), path: '/admin/team' },
          { label: t('admin.commandCenter.viewFinancials', 'Financials'), path: '/admin/financials' },
        ].map((action) => (
          <Button key={action.path} variant="outline" className="h-auto py-3 text-sm" onClick={() => navigate(action.path)}>
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default AdminCommandCenter;
