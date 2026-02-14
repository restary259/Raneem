
import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useDirection } from '@/hooks/useDirection';
import { useTranslation } from 'react-i18next';
import { User } from '@supabase/supabase-js';
import { Users, TrendingUp, ClipboardCheck, LogOut, ArrowLeftCircle, DollarSign, Image, Link, Target, CheckCircle, CreditCard, Clock, XCircle, AlertTriangle } from 'lucide-react';
import EarningsPanel from '@/components/influencer/EarningsPanel';
import MediaHub from '@/components/influencer/MediaHub';
import ReferralLink from '@/components/influencer/ReferralLink';

type TabId = 'students' | 'earnings' | 'media' | 'referral-link';

const TAB_ICONS: Record<TabId, React.ComponentType<{ className?: string }>> = {
  students: Users,
  earnings: DollarSign,
  media: Image,
  'referral-link': Link,
};

const TAB_IDS: TabId[] = ['students', 'earnings', 'media', 'referral-link'];

const InfluencerDashboardPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [checklistItems, setChecklistItems] = useState<any[]>([]);
  const [studentChecklists, setStudentChecklists] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('students');
  const navigate = useNavigate();
  const { toast } = useToast();
  const { dir } = useDirection();
  const { t } = useTranslation('dashboard');

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { navigate('/student-auth'); return; }
      setUser(session.user);

      const { data: roles } = await (supabase as any)
        .from('user_roles').select('role').eq('user_id', session.user.id).eq('role', 'influencer');
      if (!roles?.length) {
        toast({ variant: 'destructive', title: t('influencerDash.unauthorized'), description: t('influencerDash.unauthorizedDesc') });
        navigate('/'); return;
      }

      const { data: prof } = await (supabase as any).from('profiles').select('*').eq('id', session.user.id).maybeSingle();
      if (prof) setProfile(prof);

      const { data: myLeads } = await (supabase as any)
        .from('leads').select('*').eq('source_id', session.user.id).order('created_at', { ascending: false });
      if (myLeads) setLeads(myLeads);

      const { data: assignedStudents } = await (supabase as any)
        .from('profiles').select('*').eq('influencer_id', session.user.id).order('created_at', { ascending: false });
      if (assignedStudents) setStudents(assignedStudents);

      const [itemsRes, checklistsRes] = await Promise.all([
        (supabase as any).from('checklist_items').select('*').order('sort_order', { ascending: true }),
        (supabase as any).from('student_checklist').select('*'),
      ]);
      if (itemsRes.data) setChecklistItems(itemsRes.data);
      if (checklistsRes.data) setStudentChecklists(checklistsRes.data);
      setIsLoading(false);
    };
    init();
  }, [navigate, toast]);

  const handleSignOut = async () => { await supabase.auth.signOut(); navigate('/'); };

  const getProgress = (studentId: string) => {
    const total = checklistItems.length;
    if (!total) return 0;
    return Math.round((studentChecklists.filter(sc => sc.student_id === studentId && sc.is_completed).length / total) * 100);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalLeads = leads.length;
  const eligibleLeads = leads.filter(l => (l.eligibility_score ?? 0) >= 50).length;
  const paidStudents = students.filter(s => s.student_status === 'paid').length;
  const totalConverted = students.filter(s => s.student_status === 'converted' || s.student_status === 'paid').length;
  const avgProgress = students.length > 0 ? Math.round(students.reduce((sum, s) => sum + getProgress(s.id), 0) / students.length) : 0;

  return (
    <div className="min-h-screen bg-[#F8FAFC]" dir={dir}>
      <header className="bg-[#1E293B] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src="/lovable-uploads/d0f50c50-ec2b-4468-b0eb-5ba9efa39809.png" alt="Darb" className="w-10 h-10 object-contain" />
              <div>
                <h1 className="text-xl font-bold">{t('influencerDash.title')}</h1>
                <p className="text-sm text-white/70">{t('influencerDash.welcome', { name: profile?.full_name || user?.email })}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10" onClick={() => navigate('/')}>
                <ArrowLeftCircle className="h-4 w-4 me-2" />{t('lawyer.website')}
              </Button>
              <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 me-2" />{t('lawyer.signOut')}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card><CardContent className="p-4 text-center">
            <Users className="h-5 w-5 mx-auto mb-1 text-blue-600" />
            <p className="text-xs text-muted-foreground">{t('influencerDash.totalClients')}</p>
            <p className="text-xl font-bold">{totalLeads}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <Target className="h-5 w-5 mx-auto mb-1 text-emerald-600" />
            <p className="text-xs text-muted-foreground">{t('influencerDash.eligible')}</p>
            <p className="text-xl font-bold">{eligibleLeads}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <CheckCircle className="h-5 w-5 mx-auto mb-1 text-purple-600" />
            <p className="text-xs text-muted-foreground">{t('influencerDash.converted')}</p>
            <p className="text-xl font-bold">{totalConverted}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <CreditCard className="h-5 w-5 mx-auto mb-1 text-green-600" />
            <p className="text-xs text-muted-foreground">{t('influencerDash.paid')}</p>
            <p className="text-xl font-bold">{paidStudents}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <DollarSign className="h-5 w-5 mx-auto mb-1 text-amber-600" />
            <p className="text-xs text-muted-foreground">{t('influencerDash.assignedStudents')}</p>
            <p className="text-xl font-bold">{students.length}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <ClipboardCheck className="h-5 w-5 mx-auto mb-1 text-orange-600" />
            <p className="text-xs text-muted-foreground">{t('influencerDash.avgProgress')}</p>
            <p className="text-xl font-bold">{avgProgress}%</p>
          </CardContent></Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap border-b pb-2">
          {TAB_IDS.map(tabId => {
            const Icon = TAB_ICONS[tabId];
            return (
              <button
                key={tabId}
                onClick={() => setActiveTab(tabId)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tabId
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                <Icon className="h-4 w-4" />
                {t(`influencerDash.tabs.${tabId === 'referral-link' ? 'referralLink' : tabId}`)}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {activeTab === 'students' && (
          <div className="space-y-3">
            {leads.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground">{t('influencerDash.referredClients')}</h3>
                {leads.map(lead => {
                  const score = lead.eligibility_score ?? 0;
                  const isEligible = score >= 50;
                  const st = {
                    label: t(`influencerDash.leadStatuses.${lead.status}`, lead.status),
                    color: ({
                      new: 'bg-blue-100 text-blue-800',
                      eligible: 'bg-emerald-100 text-emerald-800',
                      not_eligible: 'bg-red-100 text-red-800',
                      assigned: 'bg-purple-100 text-purple-800',
                    } as Record<string, string>)[lead.status] || 'bg-blue-100 text-blue-800',
                  };
                  return (
                    <Card key={lead.id}>
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{lead.full_name}</p>
                            <p className="text-xs text-muted-foreground">{lead.city || '—'} • {lead.german_level || '—'}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${st.color}`}>{String(st.label)}</span>
                            <Badge variant="outline" className="text-xs">{score} pts</Badge>
                          </div>
                        </div>
                        <div className={`flex items-start gap-2 p-2 rounded-lg text-xs ${isEligible ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
                          {isEligible ? (
                            <><CheckCircle className="h-4 w-4 shrink-0 mt-0.5" /><span>{t('influencerDash.eligibleForApply')}</span></>
                          ) : (
                            <><XCircle className="h-4 w-4 shrink-0 mt-0.5" /><span>{lead.eligibility_reason || t('influencerDash.notMeetReqs')}</span></>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {students.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold text-sm text-muted-foreground">{t('influencerDash.enrolledStudents')}</h3>
                {students.map(s => {
                  const progress = getProgress(s.id);
                  const statusKey = s.student_status || 'eligible';
                  const statusColors: Record<string, string> = {
                    eligible: 'bg-emerald-100 text-emerald-800',
                    ineligible: 'bg-red-100 text-red-800',
                    converted: 'bg-blue-100 text-blue-800',
                    paid: 'bg-green-100 text-green-800',
                    nurtured: 'bg-purple-100 text-purple-800',
                  };
                  return (
                    <Card key={s.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium text-sm">{s.full_name}</p>
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${statusColors[statusKey] || statusColors.eligible}`}>
                            {String(t(`admin.students.statuses.${statusKey}`, { defaultValue: statusKey }))}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={progress} className="h-2 flex-1" />
                          <span className="text-xs text-muted-foreground">{progress}%</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {leads.length === 0 && students.length === 0 && (
              <p className="p-8 text-center text-muted-foreground">{t('influencerDash.noStudents')}</p>
            )}
          </div>
        )}
        {activeTab === 'earnings' && user && <EarningsPanel userId={user.id} />}
        {activeTab === 'media' && <MediaHub />}
        {activeTab === 'referral-link' && user && <ReferralLink userId={user.id} />}
      </main>
    </div>
  );
};

export default InfluencerDashboardPage;
