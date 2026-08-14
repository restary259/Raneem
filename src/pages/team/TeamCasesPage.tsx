import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
import { Search, Plus, Loader2, Phone, UserPlus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { isLinkablePhone } from '@/lib/phone';
import {
  ACTIVE_STATUSES,
  CaseStatus,
  CASE_STATUS_LABELS,
  STATUS_COLORS,
} from '@/lib/caseStatus';
import { LoadingState, EmptyState, ErrorState, usePagination, TablePagination, useDebouncedValue } from '@/components/shell';

type StatusFilter = 'all' | CaseStatus;

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

// Canonical filter list: 'all' + every active stage + terminal states.
const STATUS_FILTERS: StatusFilter[] = [
  'all',
  ...ACTIVE_STATUSES,
  CaseStatus.FORGOTTEN,
  CaseStatus.CANCELLED,
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
  const debouncedSearch = useDebouncedValue(search, 250);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // New case modal — only name + phone required (no appointment at creation)
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState<{ id: string; name: string; status: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);

  const fetchCases = useCallback(() => {
    if (!user) return () => {};
    let ignore = false;
    setLoading(true);
    setLoadError(false);
    (async () => {
      try {
        const { data, error } = await supabase
          .from('cases')
          .select('*')
          .order('last_activity_at', { ascending: false });
        if (error) throw error;
        if (!ignore) setCases((data as Case[]) ?? []);
      } catch {
        if (!ignore) {
          setLoadError(true);
          toast({ variant: 'destructive', description: isAr ? 'تعذر تحميل الملفات، حاول مرة أخرى' : 'Failed to load cases, please try again' });
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [user, toast, isAr]);

  useEffect(() => fetchCases(), [fetchCases]);

  const filtered = useMemo(() => cases.filter(c => {
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchSearch = !debouncedSearch ||
      c.full_name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      c.phone_number.includes(debouncedSearch);
    return matchStatus && matchSearch;
  }), [cases, statusFilter, debouncedSearch]);

  const pagination = usePagination(filtered, 25);

  const checkDuplicate = async (phone: string) => {
    if (!phone.trim() || phone.length < 7) return;
    setCheckingDuplicate(true);
    try {
      const { data, error } = await supabase
        .from('cases')
        .select('id, full_name, status')
        .eq('phone_number', phone.trim())
        .maybeSingle();
      if (error) throw error;
      setDuplicateWarning(data ? { id: data.id, name: data.full_name, status: data.status } : null);
    } catch (err) {
      // A failed check is not proof there is no duplicate — drop the stale
      // warning but make the failure visible instead of pretending it passed.
      console.error('[TeamCases] duplicate phone check failed:', err);
      setDuplicateWarning(null);
    } finally {
      setCheckingDuplicate(false);
    }
  };

  const handleCreateCase = async (force = false) => {
    if (!newName.trim() || !newPhone.trim()) {
      toast({ variant: 'destructive', description: isAr ? 'الاسم والهاتف مطلوبان' : 'Name and phone are required' });
      return;
    }
    if (!isLinkablePhone(newPhone)) {
      toast({
        variant: 'destructive',
        description: isAr
          ? 'رقم الهاتف غير صالح — أدخل رقمًا مثل 05XXXXXXXX'
          : 'Invalid phone number — enter a number like 05XXXXXXXX',
      });
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
    } catch {
      toast({ variant: 'destructive', description: isAr ? 'تعذر إنشاء الملف، حاول مرة أخرى' : 'Failed to create the case, please try again' });
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
    if (s === 'all') return isAr ? 'الكل' : 'All';
    const label = CASE_STATUS_LABELS[s as CaseStatus];
    return label ? (isAr ? label.ar : label.en) : s.replace(/_/g, ' ');
  };

  return (
    <div className="p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold">{isAr ? 'الملفات' : 'Cases'}</h1>
        <div className="flex items-center gap-2">
          {/* "Submit new student" is an action on this page, not its own
              sidebar destination. */}
          <Button variant="outline" size="sm" onClick={() => navigate('/team/submit')}>
            <UserPlus className="h-4 w-4 me-2" /> {isAr ? 'طالب جديد' : 'New student'}
          </Button>
          <Button onClick={() => setShowNew(true)} size="sm">
            <Plus className="h-4 w-4 me-2" /> {isAr ? 'ملف جديد' : 'New Case'}
          </Button>
        </div>
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
        <LoadingState variant="cards" rows={6} label={isAr ? 'جار التحميل...' : 'Loading...'} />
      ) : loadError ? (
        <ErrorState
          title={isAr ? 'تعذر تحميل الملفات' : 'Failed to load cases'}
          onRetry={fetchCases}
          retryLabel={isAr ? 'إعادة المحاولة' : 'Retry'}
        />
      ) : filtered.length === 0 ? (
        <EmptyState title={isAr ? 'لا توجد ملفات' : 'No cases found'} />
      ) : (
        <>
          <div className="space-y-2">
            {pagination.items.map(c => (
              <Card
                key={c.id}
                className="cursor-pointer transition-colors hover:bg-muted/40 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => navigate(`/team/cases/${c.id}`)}
              >
                <CardContent className="p-4">
                  {/* Row 1: name + badge */}
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <span className="font-semibold text-sm leading-snug truncate min-w-0 flex-1">
                      {c.full_name}
                    </span>
                    <Badge className={`shrink-0 text-xs ${STATUS_COLORS[c.status] ?? 'bg-muted text-foreground border-border'}`}>
                      {statusLabel(c.status)}
                    </Badge>
                  </div>
                  {/* Row 2: phone + timestamp */}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1 flex-wrap">
                    <Phone className="h-3 w-3 shrink-0" />
                    <span className="shrink-0">{c.phone_number}</span>
                    <span className="text-muted-foreground/40 shrink-0">·</span>
                    <span dir="ltr" className="inline-block whitespace-nowrap">
                      {formatDistanceToNow(new Date(c.last_activity_at), { addSuffix: true })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <TablePagination pagination={pagination} />
        </>
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
