import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Plus, Loader2, AlertTriangle, Phone } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

// "All" tab for team members only shows cases assigned to them OR cases they created (manual)
// Unassigned apply/contact cases are NOT visible to team members — only Admin can see/assign those
type TabId = 'mine' | 'all' | 'forgotten';
type StatusFilter = 'all' | 'new' | 'contacted' | 'appointment_scheduled' | 'profile_completion' | 'payment_confirmed' | 'submitted';

interface Case {
  id: string;
  full_name: string;
  phone_number: string;
  status: string;
  source: string;
  assigned_to: string | null;
  last_activity_at: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800 border-blue-200',
  contacted: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  appointment_scheduled: 'bg-purple-100 text-purple-800 border-purple-200',
  profile_completion: 'bg-orange-100 text-orange-800 border-orange-200',
  payment_confirmed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  submitted: 'bg-teal-100 text-teal-800 border-teal-200',
  enrollment_paid: 'bg-green-100 text-green-800 border-green-200',
  forgotten: 'bg-red-100 text-red-800 border-red-200',
};

export default function TeamCasesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { i18n } = useTranslation('dashboard');
  const isAr = i18n.language === 'ar';
  const [cases, setCases] = useState<Case[]>([]);
  const [tab, setTab] = useState<TabId>('mine');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newApptDate, setNewApptDate] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState<{ id: string; name: string; status: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);

  const fetchCases = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (tab === 'forgotten') {
        const { data } = await supabase.rpc('get_forgotten_cases' as any);
        // Filter forgotten to only show cases assigned to this team member
        const myCases = ((data as Case[]) ?? []).filter(c => c.assigned_to === user.id);
        setCases(myCases);
        setLoading(false);
        return;
      }

      let query = supabase.from('cases').select('*').order('last_activity_at', { ascending: false });

      if (tab === 'mine') {
        // My Cases: assigned to me
        query = query.eq('assigned_to', user.id);
      } else if (tab === 'all') {
        // All: only cases assigned to me OR cases I created (manual/submit_new_student)
        // This prevents team members seeing unassigned apply/contact cases
        query = query.or(`assigned_to.eq.${user.id},and(source.in.(manual,submit_new_student))`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setCases((data as Case[]) ?? []);
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setLoading(false);
    }
  }, [user, tab, toast]);

  useEffect(() => { fetchCases(); }, [fetchCases]);

  const filtered = cases.filter(c => {
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchSearch = !search || c.full_name.toLowerCase().includes(search.toLowerCase()) || c.phone_number.includes(search);
    return matchStatus && matchSearch;
  });

  const checkDuplicate = async (phone: string) => {
    if (!phone.trim() || phone.length < 7) return;
    setCheckingDuplicate(true);
    try {
      const { data } = await supabase.from('cases').select('id, full_name, status').eq('phone_number', phone.trim()).maybeSingle();
      if (data) {
        setDuplicateWarning({ id: data.id, name: data.full_name, status: data.status });
      } else {
        setDuplicateWarning(null);
      }
    } catch { /* silent */ } finally {
      setCheckingDuplicate(false);
    }
  };

  const handleCreateCase = async (force = false) => {
    if (!newName.trim() || !newPhone.trim()) {
      toast({ variant: 'destructive', description: isAr ? 'الاسم والهاتف مطلوبان' : 'Name and phone are required' });
      return;
    }
    if (!newApptDate) {
      toast({ variant: 'destructive', description: isAr ? 'يجب تحديد موعد لإنشاء الملف' : 'You must schedule an appointment to create a case' });
      return;
    }
    if (duplicateWarning && !force) {
      return; // Let user decide via the warning UI
    }
    setCreating(true);
    try {
      // Create case with appointment_scheduled status
      const { data: caseData, error: caseErr } = await supabase.from('cases').insert({
        full_name: newName.trim(),
        phone_number: newPhone.trim(),
        source: 'manual',
        assigned_to: user!.id,
        status: 'appointment_scheduled',
      }).select().single();
      if (caseErr) throw caseErr;

      // Simultaneously create the appointment
      const { error: apptErr } = await supabase.from('appointments').insert({
        case_id: (caseData as Case).id,
        team_member_id: user!.id,
        scheduled_at: new Date(newApptDate).toISOString(),
        duration_minutes: 60,
      });
      if (apptErr) console.warn('Appointment creation failed:', apptErr.message);

      toast({ title: isAr ? 'تم إنشاء الملف والموعد' : 'Case and appointment created' });
      setShowNew(false);
      setNewName(''); setNewPhone(''); setNewApptDate(''); setDuplicateWarning(null);
      navigate(`/team/cases/${(caseData as Case).id}`);
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setCreating(false);
    }
  };

  const STATUS_FILTERS: StatusFilter[] = ['all', 'new', 'contacted', 'appointment_scheduled', 'profile_completion', 'payment_confirmed', 'submitted'];

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      all: isAr ? 'الكل' : 'All',
      new: isAr ? 'جديد' : 'New',
      contacted: isAr ? 'تم التواصل' : 'Contacted',
      appointment_scheduled: isAr ? 'موعد محدد' : 'Appointment',
      profile_completion: isAr ? 'استكمال الملف' : 'Profile',
      payment_confirmed: isAr ? 'تم الدفع' : 'Payment',
      submitted: isAr ? 'تم التقديم' : 'Submitted',
      enrollment_paid: isAr ? 'مسجل' : 'Enrolled',
      forgotten: isAr ? 'منسي' : 'Forgotten',
    };
    return map[s] ?? s.replace(/_/g, ' ');
  };

  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{isAr ? 'الملفات' : 'Cases'}</h1>
        <Button onClick={() => setShowNew(true)} size="sm">
          <Plus className="h-4 w-4 me-2" /> {isAr ? 'ملف جديد' : 'New Case'}
        </Button>
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v as TabId)}>
        <TabsList>
          <TabsTrigger value="mine">{isAr ? 'ملفاتي' : 'My Cases'}</TabsTrigger>
          <TabsTrigger value="all">{isAr ? 'الكل' : 'All'}</TabsTrigger>
          <TabsTrigger value="forgotten" className="text-destructive">
            <AlertTriangle className="h-3 w-3 me-1" /> {isAr ? 'منسية' : 'Forgotten'}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={isAr ? 'بحث بالاسم أو الهاتف...' : 'Search name or phone...'}
            className="ps-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map(s => (
            <Button key={s} size="sm" variant={statusFilter === s ? 'default' : 'outline'} onClick={() => setStatusFilter(s)} className="text-xs h-9">
              {statusLabel(s)}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">{isAr ? 'جار التحميل...' : 'Loading...'}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>{isAr ? 'لا توجد ملفات' : 'No cases found'}</p>
          {tab === 'all' && (
            <p className="text-xs mt-2 text-muted-foreground/60">
              {isAr ? 'الملفات غير المعيّنة تظهر للمدير فقط' : 'Unassigned cases are only visible to Admin'}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <Card key={c.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/team/cases/${c.id}`)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">{c.full_name}</div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                    <Phone className="h-3 w-3" />{c.phone_number}
                    <span>·</span>
                    <span>{formatDistanceToNow(new Date(c.last_activity_at), { addSuffix: true })}</span>
                  </div>
                </div>
                <Badge className={STATUS_COLORS[c.status] ?? 'bg-muted text-foreground'}>
                  {statusLabel(c.status)}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showNew} onOpenChange={open => { setShowNew(open); if (!open) { setNewName(''); setNewPhone(''); setNewApptDate(''); setDuplicateWarning(null); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{isAr ? 'إنشاء ملف جديد' : 'Create New Case'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{isAr ? 'الاسم الكامل *' : 'Full Name *'}</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder={isAr ? 'اسم الطالب' : 'Student name'} />
            </div>
            <div>
              <Label>{isAr ? 'الهاتف *' : 'Phone *'}</Label>
              <Input
                value={newPhone}
                onChange={e => { setNewPhone(e.target.value); setDuplicateWarning(null); }}
                onBlur={e => checkDuplicate(e.target.value)}
                placeholder="+972..."
              />
              {checkingDuplicate && <p className="text-xs text-muted-foreground mt-1">{isAr ? 'جار التحقق...' : 'Checking...'}</p>}
              {duplicateWarning && (
                <div className="mt-2 p-3 rounded-lg border border-amber-300 bg-amber-50 text-xs space-y-2">
                  <p className="font-medium text-amber-800">
                    {isAr ? `⚠️ يوجد ملف بهذا الرقم: ${duplicateWarning.name}` : `⚠️ Existing case: ${duplicateWarning.name} (${duplicateWarning.status})`}
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setShowNew(false); navigate(`/team/cases/${duplicateWarning.id}`); }}>
                      {isAr ? 'عرض الملف' : 'View Case'}
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs text-amber-700 border-amber-300" onClick={() => handleCreateCase(true)}>
                      {isAr ? 'إنشاء على أي حال' : 'Create Anyway'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <div>
              <Label>{isAr ? 'موعد الاجتماع *' : 'Appointment Date & Time *'}</Label>
              <Input
                type="datetime-local"
                value={newApptDate}
                onChange={e => setNewApptDate(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {isAr ? 'مطلوب — لا يمكن إنشاء ملف بدون موعد' : 'Required — a case cannot be created without an appointment'}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={() => handleCreateCase(false)} disabled={creating || !newApptDate}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : (isAr ? 'إنشاء' : 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
