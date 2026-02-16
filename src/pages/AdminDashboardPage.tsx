import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { User } from '@supabase/supabase-js';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminOverview from '@/components/admin/AdminOverview';
import AdminAnalytics from '@/components/admin/AdminAnalytics';
import LeadsManagement from '@/components/admin/LeadsManagement';
import CasesManagement from '@/components/admin/CasesManagement';
import StudentCasesManagement from '@/components/admin/StudentCasesManagement';
import MoneyDashboard from '@/components/admin/MoneyDashboard';
import MasterServicesManagement from '@/components/admin/MasterServicesManagement';
import InfluencerManagement from '@/components/admin/InfluencerManagement';
import PartnersManagement from '@/components/admin/PartnersManagement';
import SettingsPanel from '@/components/admin/SettingsPanel';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

const AdminDashboardPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [students, setStudents] = useState<any[]>([]);
  const [influencers, setInfluencers] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]);
  const [lawyers, setLawyers] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [rewards, setRewards] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loginAttempts, setLoginAttempts] = useState<any[]>([]);
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
      await fetchAllData();
      setIsLoading(false);
    };
    init();
  }, [navigate, toast]);

  const fetchAllData = useCallback(async () => {
    const [p, s, pay, items, inv, roles, leadsRes, casesRes, lawyerRoles, commissionsRes, rewardsRes, audit, logins] = await Promise.all([
      (supabase as any).from('profiles').select('*').order('created_at', { ascending: false }),
      (supabase as any).from('services').select('*').order('created_at', { ascending: false }),
      (supabase as any).from('payments').select('*').order('created_at', { ascending: false }),
      (supabase as any).from('checklist_items').select('*').order('sort_order', { ascending: true }),
      (supabase as any).from('influencer_invites').select('*').order('created_at', { ascending: false }),
      (supabase as any).from('user_roles').select('*').eq('role', 'influencer'),
      (supabase as any).from('leads').select('*').order('created_at', { ascending: false }),
      (supabase as any).from('student_cases').select('*').order('created_at', { ascending: false }),
      (supabase as any).from('user_roles').select('*').eq('role', 'lawyer'),
      (supabase as any).from('commissions').select('*'),
      (supabase as any).from('rewards').select('*'),
      (supabase as any).from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(100),
      (supabase as any).from('login_attempts').select('*').order('created_at', { ascending: false }).limit(200),
    ]);

    if (p.data) setStudents(p.data);
    if (s.data) setServices(s.data);
    if (pay.data) setPayments(pay.data);
    if (inv.data) setInvites(inv.data);
    if (leadsRes.data) setLeads(leadsRes.data);
    if (casesRes.data) setCases(casesRes.data);
    if (commissionsRes.data) setCommissions(commissionsRes.data);
    if (rewardsRes.data) setRewards(rewardsRes.data);
    if (audit.data) setAuditLogs(audit.data);
    if (logins.data) setLoginAttempts(logins.data);

    if (roles.data) {
      const influencerIds = roles.data.map((r: any) => r.user_id);
      if (influencerIds.length > 0) {
        const { data: infProfiles } = await (supabase as any)
          .from('profiles').select('*').in('id', influencerIds);
        if (infProfiles) setInfluencers(infProfiles);
      } else {
        setInfluencers([]);
      }
    }

    if (lawyerRoles.data) {
      const lawyerIds = lawyerRoles.data.map((r: any) => r.user_id);
      if (lawyerIds.length > 0) {
        const { data: lawyerProfiles } = await (supabase as any)
          .from('profiles').select('id, full_name, email, commission_amount').in('id', lawyerIds);
        if (lawyerProfiles) setLawyers(lawyerProfiles);
      } else {
        setLawyers([]);
      }
    }
  }, []);

  // Real-time subscriptions
  useRealtimeSubscription('leads', fetchAllData, isAdmin);
  useRealtimeSubscription('student_cases', fetchAllData, isAdmin);
  useRealtimeSubscription('commissions', fetchAllData, isAdmin);
  useRealtimeSubscription('rewards', fetchAllData, isAdmin);
  useRealtimeSubscription('payout_requests', fetchAllData, isAdmin);
  useRealtimeSubscription('profiles', fetchAllData, isAdmin);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;

  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);
  const totalStudents = students.length;
  const newThisMonth = students.filter((s: any) => s.created_at?.startsWith(currentMonth)).length;
  const totalPayments = payments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);

  const handleStageClick = (stage: string) => {
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
        return <LeadsManagement leads={leads} lawyers={lawyers} influencers={influencers} onRefresh={fetchAllData} />;
      case 'cases':
        return <CasesManagement cases={cases} leads={leads.map(l => ({ id: l.id, full_name: l.full_name, phone: l.phone, source_type: l.source_type, source_id: l.source_id }))} lawyers={lawyers} onRefresh={fetchAllData} />;
      case 'student-cases':
        return <StudentCasesManagement cases={cases} leads={leads} lawyers={lawyers} influencers={influencers} onRefresh={fetchAllData} />;
      case 'team-members':
        return (
          <InfluencerManagement
            influencers={[]}
            invites={invites}
            students={students}
            lawyers={lawyers}
            onRefresh={fetchAllData}
            filterRole="lawyer"
          />
        );
      case 'influencers':
        return (
          <InfluencerManagement
            influencers={influencers}
            invites={invites}
            students={students}
            lawyers={[]}
            onRefresh={fetchAllData}
            filterRole="influencer"
          />
        );
      case 'partners':
        return (
          <PartnersManagement
            influencers={influencers}
            invites={invites}
            students={students}
            lawyers={lawyers}
            profiles={[...students, ...influencers].map(p => ({ id: p.id, full_name: p.full_name }))}
            onRefresh={fetchAllData}
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
    <AdminLayout activeTab={activeTab} onTabChange={setActiveTab} userEmail={user?.email}>
      {renderContent()}
    </AdminLayout>
  );
};

export default AdminDashboardPage;
