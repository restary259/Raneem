import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { User } from '@supabase/supabase-js';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminOverview from '@/components/admin/AdminOverview';
import LeadsManagement from '@/components/admin/LeadsManagement';
import StudentCasesManagement from '@/components/admin/StudentCasesManagement';
import MoneyDashboard from '@/components/admin/MoneyDashboard';

import InfluencerManagement from '@/components/admin/InfluencerManagement';
import StudentProfilesManagement from '@/components/admin/StudentProfilesManagement';
import SettingsPanel from '@/components/admin/SettingsPanel';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { useDashboardData } from '@/hooks/useDashboardData';
import DashboardContainer from '@/components/dashboard/DashboardContainer';
import PullToRefresh from '@/components/common/PullToRefresh';
import TabErrorBoundary from '@/components/common/TabErrorBoundary';

const AdminDashboardPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [pendingCredentials, setPendingCredentials] = useState<{ email: string; password: string } | null>(null);
  // Issue 1: Funnel stage click → auto-filter on leads/cases tab
  const [funnelFilter, setFunnelFilter] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation('dashboard');

  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { navigate('/student-auth'); return; }
      setUser(session.user);

      try {
        const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ action: 'dashboard_access' }),
        });
        const result = await resp.json();
        if (!result.isAdmin) {
          toast({ variant: 'destructive', title: t('admin.auth.unauthorized', 'Unauthorized'), description: t('admin.auth.noAccess', 'You do not have access.') });
          navigate('/');
          return;
        }
      } catch {
        toast({ variant: 'destructive', title: t('common.error'), description: t('admin.auth.verifyFailed', 'Failed to verify permissions.') });
        navigate('/');
        return;
      }

      setIsAdmin(true);
      setSessionReady(true);
    };

    init();
  }, []);

  const onError = useCallback((err: string) => {
    toast({ variant: 'destructive', title: t('common.error'), description: err });
  }, [toast, t]);

  const { data, error, isLoading, refetch } = useDashboardData({
    type: 'admin',
    enabled: sessionReady,
    onError,
  });

  const students = data?.students ?? [];
  const services = data?.services ?? [];
  const payments = data?.payments ?? [];
  const invites = data?.invites ?? [];
  const leads = data?.leads ?? [];
  const cases = data?.cases ?? [];
  const influencers = data?.influencers ?? [];
  const lawyers = data?.lawyers ?? [];
  const commissions = data?.commissions ?? [];
  const rewards = data?.rewards ?? [];
  const auditLogs = data?.auditLogs ?? [];
  const loginAttempts = data?.loginAttempts ?? [];
  const payoutRequests = data?.payoutRequests ?? [];

  useRealtimeSubscription('leads', refetch, isAdmin);
  useRealtimeSubscription('student_cases', refetch, isAdmin);
  useRealtimeSubscription('payout_requests', refetch, isAdmin);
  useRealtimeSubscription('rewards', refetch, isAdmin);
  useRealtimeSubscription('commissions', refetch, isAdmin);
  useRealtimeSubscription('case_payments', refetch, isAdmin);
  useRealtimeSubscription('notifications', refetch, isAdmin);

  if (!sessionReady) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-muted-foreground text-sm">{t('admin.auth.verifying', 'Verifying permissions…')}</p>
      </div>
    </div>
  );

  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);

  const nonStudentIds = new Set([
    ...influencers.map((i: any) => i.id),
    ...lawyers.map((l: any) => l.id),
  ]);
  if (user) nonStudentIds.add(user.id);
  const actualStudents = students.filter((s: any) => !nonStudentIds.has(s.id));

  const totalStudents = actualStudents.length;
  const newThisMonth = actualStudents.filter((s: any) => s.created_at?.startsWith(currentMonth)).length;
  // Issue 4: Standardize on !!c.paid_at as single source of truth
  const totalPayments = cases.filter((c: any) => !!c.paid_at)
    .reduce((sum: number, c: any) => sum + (Number(c.service_fee) || 0) + (Number(c.school_commission) || 0), 0);

  // Issue 1: Wire funnel click to filter + switch tab
  const handleStageClick = (stage: string) => {
    // Map funnel stage to the appropriate tab & filter
    const leadStages = ['new', 'eligible', 'not_eligible'];
    if (leadStages.includes(stage)) {
      setFunnelFilter(stage);
      setActiveTab('leads');
    } else {
      setFunnelFilter(stage);
      setActiveTab('student-cases');
    }
  };

  const renderContent = () => {
    const content = (() => {
      switch (activeTab) {
        case 'overview':
          return (
            <AdminOverview
              totalStudents={totalStudents}
              newThisMonth={newThisMonth}
              totalPayments={totalPayments}
              newContacts={0}
              totalDocuments={0}
              activeServices={services.filter((s: any) => s.status !== 'completed').length}
              totalInfluencers={influencers.length}
              leads={leads}
              cases={cases}
              rewards={rewards}
              commissions={commissions}
              lawyers={lawyers}
              influencers={influencers}
              onStageClick={handleStageClick}
            />
          );
        case 'leads':
          return <LeadsManagement leads={leads} lawyers={lawyers} influencers={influencers} onRefresh={refetch} initialFilter={funnelFilter} />;
        case 'student-cases':
          return <StudentCasesManagement cases={cases} leads={leads} lawyers={lawyers} influencers={influencers} onRefresh={refetch} initialFilter={funnelFilter} />;
        case 'team':
          return (
            <InfluencerManagement
              influencers={influencers}
              invites={invites}
              students={students}
              lawyers={lawyers}
              onRefresh={refetch}
              pendingCredentials={pendingCredentials}
              onCredentialsCreated={(email, password) => setPendingCredentials({ email, password })}
              onCredentialsDismissed={() => { setPendingCredentials(null); refetch(); }}
            />
          );
        case 'students':
          return (
            <StudentProfilesManagement
              students={actualStudents}
              influencers={influencers}
              leads={leads}
              onRefresh={refetch}
            />
          );
        case 'money':
          return <MoneyDashboard cases={cases} leads={leads} rewards={rewards} commissions={commissions} influencers={influencers} lawyers={lawyers} onRefresh={refetch} payoutRequests={payoutRequests} />;
        case 'settings':
          return <SettingsPanel loginAttempts={loginAttempts} auditLogs={auditLogs} />;
        default:
          return null;
      }
    })();
    return <TabErrorBoundary key={activeTab}>{content}</TabErrorBoundary>;
  };

  return (
    <DashboardContainer
      isLoading={isLoading}
      error={!isLoading ? error : null}
      onRetry={refetch}
    >
      <AdminLayout activeTab={activeTab} onTabChange={(tab) => { setActiveTab(tab); setFunnelFilter(null); }} userEmail={user?.email}>
        <PullToRefresh onRefresh={async () => { await refetch(); }}>
          {renderContent()}
        </PullToRefresh>
      </AdminLayout>
    </DashboardContainer>
  );
};

export default AdminDashboardPage;
