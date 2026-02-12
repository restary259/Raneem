import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useDirection } from '@/hooks/useDirection';
import { User } from '@supabase/supabase-js';
import { Users, TrendingUp, ClipboardCheck, LogOut, ArrowLeftCircle, DollarSign, Image, Link } from 'lucide-react';
import EarningsPanel from '@/components/influencer/EarningsPanel';
import MediaHub from '@/components/influencer/MediaHub';
import ReferralLink from '@/components/influencer/ReferralLink';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  eligible: { label: 'مؤهل', color: 'bg-emerald-100 text-emerald-800' },
  ineligible: { label: 'غير مؤهل', color: 'bg-red-100 text-red-800' },
  converted: { label: 'محوّل', color: 'bg-blue-100 text-blue-800' },
  paid: { label: 'مدفوع', color: 'bg-green-100 text-green-800' },
  nurtured: { label: 'متابَع', color: 'bg-purple-100 text-purple-800' },
};

type TabId = 'students' | 'earnings' | 'media' | 'referral-link';

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'students', label: 'الطلاب', icon: Users },
  { id: 'earnings', label: 'الأرباح', icon: DollarSign },
  { id: 'media', label: 'المحتوى', icon: Image },
  { id: 'referral-link', label: 'رابط الإحالة', icon: Link },
];

const InfluencerDashboardPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [checklistItems, setChecklistItems] = useState<any[]>([]);
  const [studentChecklists, setStudentChecklists] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('students');
  const navigate = useNavigate();
  const { toast } = useToast();
  const { dir } = useDirection();

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { navigate('/student-auth'); return; }
      setUser(session.user);

      const { data: roles } = await (supabase as any)
        .from('user_roles').select('role').eq('user_id', session.user.id).eq('role', 'influencer');
      if (!roles?.length) {
        toast({ variant: 'destructive', title: 'غير مصرح', description: 'هذه الصفحة للوكلاء فقط.' });
        navigate('/'); return;
      }

      const { data: prof } = await (supabase as any).from('profiles').select('*').eq('id', session.user.id).maybeSingle();
      if (prof) setProfile(prof);

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
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalConverted = students.filter(s => s.student_status === 'converted' || s.student_status === 'paid').length;
  const avgProgress = students.length > 0 ? Math.round(students.reduce((sum, s) => sum + getProgress(s.id), 0) / students.length) : 0;

  return (
    <div className="min-h-screen bg-muted/30" dir={dir}>
      <header className="bg-[hsl(215,50%,23%)] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src="/lovable-uploads/d0f50c50-ec2b-4468-b0eb-5ba9efa39809.png" alt="Darb" className="w-10 h-10 object-contain" />
              <div>
                <h1 className="text-xl font-bold">لوحة تحكم الوكيل</h1>
                <p className="text-sm text-white/70">مرحباً، {profile?.full_name || user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10" onClick={() => navigate('/')}>
                <ArrowLeftCircle className="h-4 w-4 me-2" />الموقع
              </Button>
              <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 me-2" />خروج
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card><CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-600"><Users className="h-6 w-6 text-white" /></div>
            <div><p className="text-sm text-muted-foreground">إجمالي الطلاب</p><p className="text-2xl font-bold">{students.length}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-600"><TrendingUp className="h-6 w-6 text-white" /></div>
            <div><p className="text-sm text-muted-foreground">محوّل / مدفوع</p><p className="text-2xl font-bold">{totalConverted}</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-amber-500"><ClipboardCheck className="h-6 w-6 text-white" /></div>
            <div><p className="text-sm text-muted-foreground">متوسط تقدم القائمة</p><p className="text-2xl font-bold">{avgProgress}%</p></div>
          </CardContent></Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap border-b pb-2">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {activeTab === 'students' && (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-start font-semibold">الاسم</th>
                      <th className="px-4 py-3 text-start font-semibold">البريد</th>
                      <th className="px-4 py-3 text-start font-semibold">الحالة</th>
                      <th className="px-4 py-3 text-start font-semibold">تقدم القائمة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map(s => {
                      const progress = getProgress(s.id);
                      const statusInfo = STATUS_LABELS[s.student_status] || STATUS_LABELS.eligible;
                      return (
                        <tr key={s.id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-medium">{s.full_name}</td>
                          <td className="px-4 py-3 text-muted-foreground">{s.email}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Progress value={progress} className="h-2 w-20" />
                              <span className="text-xs text-muted-foreground">{progress}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {students.length === 0 && <p className="p-8 text-center text-muted-foreground">لا يوجد طلاب معينين لك حالياً</p>}
              </div>
            </CardContent>
          </Card>
        )}
        {activeTab === 'earnings' && user && <EarningsPanel userId={user.id} />}
        {activeTab === 'media' && <MediaHub />}
        {activeTab === 'referral-link' && user && <ReferralLink userId={user.id} />}
      </main>
    </div>
  );
};

export default InfluencerDashboardPage;
