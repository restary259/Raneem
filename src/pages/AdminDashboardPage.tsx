import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { User } from '@supabase/supabase-js';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminOverview from '@/components/admin/AdminOverview';
import AdminAnalytics from '@/components/admin/AdminAnalytics';
import LeadsManagement from '@/components/admin/LeadsManagement';
import StudentCasesManagement from '@/components/admin/StudentCasesManagement';
import MoneyDashboard from '@/components/admin/MoneyDashboard';
import MasterServicesManagement from '@/components/admin/MasterServicesManagement';
import InfluencerManagement from '@/components/admin/InfluencerManagement';
import StudentProfilesManagement from '@/components/admin/StudentProfilesManagement';
import SettingsPanel from '@/components/admin/SettingsPanel';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { useDashboardData } from '@/hooks/useDashboardData';
import DashboardContainer from '@/components/dashboard/DashboardContainer';
import PullToRefresh from '@/components/common/PullToRefresh';

const AdminDashboardPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
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
          toast({ variant: 'destructive', title: 'غير مصرح', description: 'ليس لديك صلاحية الوصول.' });
          navigate('/');
          return;
        }
      } catch {
        toast({ variant: 'destructive', title: 'خطأ', description: 'فشل التحقق من الصلاحيات.' });
        navigate('/');
        return;
      }

      setIsAdmin(true);
      setAuthReady(true);
    };
    init();
  }, [navigate, toast]);

  // Centralised data layer
  const { data, error, isLoading, refetch } = useDashboardData({
    type: 'admin',
    enabled: authReady,
    onError: (err) => toast({ variant: 'destructive', title: 'خطأ في التحميل', description: err }),
  });

  // Safe extractions
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

  // Real-time subscriptions
  useRealtimeSubscription('leads', refetch, isAdmin);
  useRealtimeSubscription('student_cases', refetch, isAdmin);
  useRealtimeSubscription('commissions', refetch, isAdmin);
  useRealtimeSubscription('rewards', refetch, isAdmin);
  useRealtimeSubscription('payout_requests', refetch, isAdmin);
  useRealtimeSubscription('profiles', refetch, isAdmin);

  if (!authReady && !isAdmin) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-muted-foreground text-sm">جاري التحقق من الصلاحيات…</p>
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
  const totalPayments = payments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);

  const handleStageClick = (_stage: string) => {
    setActiveTab('leads');
  };

  const renderContent = () => {
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
            lawyers={lawyers}
            influencers={influencers}
            onStageClick={handleStageClick}
          />
        );
      case 'analytics':
        return (
          <AdminAnalytics
            leads={leads}
            cases={cases}
            rewards={rewards}
            commissions={commissions}
            lawyers={lawyers}
            influencers={influencers}
          />
        );
      case 'leads':
        return <LeadsManagement leads={leads} lawyers={lawyers} influencers={influencers} onRefresh={refetch} />;
      case 'student-cases':
        return <StudentCasesManagement cases={cases} leads={leads} lawyers={lawyers} influencers={influencers} onRefresh={refetch} />;
      case 'team':
        return (
          <InfluencerManagement
            influencers={influencers}
            invites={invites}
            students={students}
            lawyers={lawyers}
            onRefresh={refetch}
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
        return <MoneyDashboard cases={cases} leads={leads} rewards={rewards} commissions={commissions} influencers={influencers} lawyers={lawyers} />;
      case 'master-services':
        return <MasterServicesManagement />;
      case 'settings':
        return <SettingsPanel loginAttempts={loginAttempts} auditLogs={auditLogs} />;
      default:
        return null;
    }
  };

  return (
    <DashboardContainer
      isLoading={isLoading}
      error={!isLoading ? error : null}
      onRetry={refetch}
    >
      <AdminLayout activeTab={activeTab} onTabChange={setActiveTab} userEmail={user?.email}>
        <PullToRefresh onRefresh={async () => { await refetch(); }}>
          {renderContent()}
        </PullToRefresh>
      </AdminLayout>
    </DashboardContainer>
  );
};

export default AdminDashboardPage;

