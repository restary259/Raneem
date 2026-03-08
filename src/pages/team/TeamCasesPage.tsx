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
import { Search, Plus, Loader2, Phone } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

type StatusFilter =
  | 'all'
  | 'new'
  | 'contacted'
  | 'appointment_scheduled'
  | 'profile_completion'
  | 'payment_confirmed'
  | 'submitted'
  | 'enrollment_paid'
  | 'forgotten';

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
  payment_confirmed: 'bg-amber-100 text-amber-800 border-amber-200',
  submitted: 'bg-teal-100 text-teal-800 border-teal-200',
  enrollment_paid: 'bg-green-100 text-green-800 border-green-200',
  forgotten: 'bg-red-100 text-red-800 border-red-200',
};

// 'new' is included — cases start at new
const STATUS_FILTERS: StatusFilter[] = [
  'all',
  'new',
  'contacted',
  'appointment_scheduled',
  'profile_completion',
  'payment_confirmed',
  'submitted',
  'enrollment_paid',
  'forgotten',
];

export default function TeamCasesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { i18n } = useTranslation('dashboard');
  const isAr = i18n.language === 'ar';

  const [cases, setCases] = useState<Case[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // New case modal — only name + phone required (no appointment at creation)
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState<{ id: string; name: string; status: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);

  const fetchCases = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .order('last_activity_at', { ascending: false });
      if (error) throw error;
      setCases((data as Case[]) ?? []);
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => { fetchCases(); }, [fetchCases]);

  const filtered = cases.filter(c => {
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchSearch = !search ||
      c.full_name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone_number.includes(search);
    return matchStatus && matchSearch;
  });

  const checkDuplicate = async (phone: string) => {
    if (!phone.trim() || phone.length < 7) return;
    setCheckingDuplicate(true);
    try {
      const { data } = await supabase
        .from('cases')
        .select('id, full_name, status')
        .eq('phone_number', phone.trim())
        .maybeSingle();
      setDuplicateWarning(data ? { id: data.id, name: data.full_name, status: data.status } : null);
    } catch { /* silent */ } finally {
      setCheckingDuplicate(false);
    }
  };

  const handleCreateCase = async (force = false) => {
    if (!newName.trim() || !newPhone.trim()) {
      toast({ variant: 'destructive', description: isAr ? 'الاسم والهاتف مطلوبان' : 'Name and phone are required' });
      return;
    }
    if (duplicateWarning && !force) return;

    setCreating(true);
    try {
      // Cases start at 'new' — no appointment required at creation
      const { data: caseData, error: caseErr } = await supabase.from('cases').insert({
        full_name: newName.trim(),
        phone_number: newPhone.trim(),
        source: 'manual',
        assigned_to: user!.id,
        status: 'new',
      }).select().single();
      if (caseErr) throw caseErr;

      toast({ title: isAr ? 'تم إنشاء الملف' : 'Case created' });
      resetNewModal();
      navigate(`/team/cases/${(caseData as Case).id}`);
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setCreating(false);
    }
  };

  const resetNewModal = () => {
    setShowNew(false);
    setNewName('');
    setNewPhone('');
    setDuplicateWarning(null);
  };

  const statusLabel = (s: string) => {
    const map: Record<string, { ar: string; en: string }> = {
      all:                   { ar: 'الكل',              en: 'All' },
      new:                   { ar: 'جديد',              en: 'New' },
      contacted:             { ar: 'تم التواصل',         en: 'Contacted' },
      appointment_scheduled: { ar: 'موعد محدد',          en: 'Appointment' },
      profile_completion:    { ar: 'استكمال الملف',      en: 'Profile' },
      payment_confirmed:     { ar: 'تأكيد الدفع',        en: 'Payment' },
      submitted:             { ar: 'تم التقديم',         en: 'Submitted' },
      enrollment_paid:       { ar: 'مسجل',              en: 'Enrolled' },
      forgotten:             { ar: 'منسي',              en: 'Forgotten' },
    };
    return isAr ? (map[s]?.ar ?? s) : (map[s]?.en ?? s.replace(/_/g, ' '));
  };

  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{isAr ? 'الملفات' : 'Cases'}</h1>
        <Button onClick={() => setShowNew(true)} size="sm">
          <Plus className="h-4 w-4 me-2" /> {isAr ? 'ملف جديد' : 'New Case'}
        </Button>
      </div>

      {/* Search + Status filter pills */}
      <div className="flex gap-2 flex-col sm:flex-row">
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
            <Button
              key={s}
              size="sm"
              variant={statusFilter === s ? 'default' : 'outline'}
              onClick={() => setStatusFilter(s)}
              className={`text-xs h-9 ${s === 'forgotten' ? 'border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground' : ''}`}
            >
              {statusLabel(s)}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
          {isAr ? 'جار التحميل...' : 'Loading...'}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>{isAr ? 'لا توجد ملفات' : 'No cases found'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => (
            <Card
              key={c.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/team/cases/${c.id}`)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">{c.full_name}</div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                    <Phone className="h-3 w-3" />{c.phone_number}
                    <span>·</span>
                    <span dir="ltr" className="inline-block">{formatDistanceToNow(new Date(c.last_activity_at), { addSuffix: true })}</span>
                  </div>
                </div>
                <Badge className={STATUS_COLORS[c.status] ?? 'bg-muted text-foreground border-border'}>
                  {statusLabel(c.status)}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New Case Dialog — only name + phone required */}
      <Dialog open={showNew} onOpenChange={open => { if (!open) resetNewModal(); else setShowNew(true); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{isAr ? 'إنشاء ملف جديد' : 'Create New Case'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {isAr ? 'سيبدأ الملف في مرحلة "جديد". يمكنك جدولة موعد لاحقاً بعد التواصل مع الطالب.' : 'The case will start at "New" stage. You can schedule an appointment after contacting the student.'}
            </p>
            <div>
              <Label>{isAr ? 'الاسم الكامل *' : 'Full Name *'}</Label>
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder={isAr ? 'اسم الطالب' : 'Student name'}
              />
            </div>
            <div>
              <Label>{isAr ? 'الهاتف *' : 'Phone *'}</Label>
              <Input
                value={newPhone}
                onChange={e => { setNewPhone(e.target.value); setDuplicateWarning(null); }}
                onBlur={e => checkDuplicate(e.target.value)}
                placeholder="+972..."
              />
              {checkingDuplicate && (
                <p className="text-xs text-muted-foreground mt-1">{isAr ? 'جار التحقق...' : 'Checking...'}</p>
              )}
              {duplicateWarning && (
                <div className="mt-2 p-3 rounded-lg border border-border bg-muted text-xs space-y-2">
                  <p className="font-medium text-foreground">
                    {isAr
                      ? `⚠️ يوجد ملف بهذا الرقم: ${duplicateWarning.name}`
                      : `⚠️ Existing case: ${duplicateWarning.name} (${statusLabel(duplicateWarning.status)})`}
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="h-7 text-xs"
                      onClick={() => { resetNewModal(); navigate(`/team/cases/${duplicateWarning.id}`); }}>
                      {isAr ? 'عرض الملف' : 'View Case'}
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs"
                      onClick={() => handleCreateCase(true)}>
                      {isAr ? 'إنشاء على أي حال' : 'Create Anyway'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetNewModal}>{isAr ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={() => handleCreateCase(false)} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : (isAr ? 'إنشاء' : 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
