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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, Loader2, Phone, UserCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { isLinkablePhone } from '@/lib/phone';
import { useIsManager } from '@/hooks/useIsManager';
import {
  ACTIVE_STATUSES,
  CaseStatus,
  CASE_STATUS_LABELS,
  STATUS_COLORS,
} from '@/lib/caseStatus';

type StatusFilter = 'all' | CaseStatus;

interface Case {
  id: string;
  full_name: string;
  phone_number: string;
  status: string;
  source: string;
  assigned_to: string | null;
  partner_id: string | null;
  last_activity_at: string;
  created_at: string;
}

interface TeamDirMember {
  id: string;
  full_name: string;
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
  const { t, i18n } = useTranslation('dashboard');
  const isAr = i18n.language === 'ar';
  const { isManager } = useIsManager();

  const [cases, setCases] = useState<Case[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamDirMember[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [needsAssignmentOnly, setNeedsAssignmentOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);

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
      const caseQuery = supabase
        .from('cases')
        .select('id, full_name, phone_number, status, source, assigned_to, partner_id, last_activity_at, created_at')
        .order('last_activity_at', { ascending: false });

      if (isManager) {
        // Managers also need the team directory to power the inline assign Select.
        const [caseRes, teamRes] = await Promise.all([
          caseQuery,
          supabase.rpc('list_team_directory'),
        ]);
        if (caseRes.error) throw caseRes.error;
        setCases((caseRes.data as Case[]) ?? []);
        setTeamMembers((teamRes.data as TeamDirMember[]) ?? []);
      } else {
        const { data, error } = await caseQuery;
        if (error) throw error;
        setCases((data as Case[]) ?? []);
      }
    } catch {
      toast({ variant: 'destructive', description: isAr ? 'تعذر تحميل الملفات، حاول مرة أخرى' : 'Failed to load cases, please try again' });
    } finally {
      setLoading(false);
    }
  }, [user, toast, isManager]);

  useEffect(() => { fetchCases(); }, [fetchCases]);

  const assignCase = async (caseId: string, userId: string | null) => {
    setAssigning(caseId);
    try {
      // Only assigned_to is touched; RLS restricts the UPDATE to that column.
      const { error } = await supabase
        .from('cases')
        .update({ assigned_to: userId || null })
        .eq('id', caseId);
      if (error) throw error;
      setCases(prev => prev.map(c => (c.id === caseId ? { ...c, assigned_to: userId } : c)));
      toast({ description: t('admin.pipeline.caseAssigned', 'Case assigned successfully') });
    } catch (err: unknown) {
      toast({ variant: 'destructive', description: err instanceof Error ? err.message : '' });
    } finally {
      setAssigning(null);
    }
  };

  const assigneeName = (id: string | null) =>
    id ? teamMembers.find(tm => tm.id === id)?.full_name ?? null : null;

  const filtered = cases.filter(c => {
    const matchStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchSearch = !search ||
      c.full_name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone_number.includes(search);
    // Manager-only triage filter: partner/ambassador referrals with no assignee.
    const matchNeedsAssignment = !needsAssignmentOnly || (!!c.partner_id && !c.assigned_to);
    return matchStatus && matchSearch && matchNeedsAssignment;
  });

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
        <div className="flex gap-1 flex-wrap items-center">
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
          {/* Manager-only triage filter: unassigned partner/ambassador referrals. */}
          {isManager && (
            <Button
              size="sm"
              variant={needsAssignmentOnly ? 'default' : 'outline'}
              onClick={() => setNeedsAssignmentOnly(v => !v)}
              className="text-xs h-9"
            >
              <UserCheck className="h-3.5 w-3.5 me-1" />
              {t('manager.needsAssignment', 'Needs assignment')}
            </Button>
          )}
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
                {/* Manager-only assign control (updates assigned_to only). */}
                {isManager && (
                  <div
                    className="mt-2 flex items-center gap-2"
                    // Prevent the card's navigate-on-click from firing when
                    // interacting with the assign Select.
                    onClick={e => e.stopPropagation()}
                  >
                    <Select
                      value={c.assigned_to || 'unassigned'}
                      onValueChange={val => assignCase(c.id, val === 'unassigned' ? null : val)}
                      disabled={assigning === c.id}
                    >
                      <SelectTrigger className="h-8 w-full sm:w-56 text-xs">
                        <UserCheck className="h-3.5 w-3.5 me-1.5 shrink-0" />
                        <SelectValue placeholder={t('admin.pipeline.assignPlaceholder', 'Assign to team member')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">{t('admin.pipeline.unassigned', 'Unassigned')}</SelectItem>
                        {teamMembers.map(tm => (
                          <SelectItem key={tm.id} value={tm.id}>{tm.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {c.assigned_to && assigneeName(c.assigned_to) && (
                      <span className="hidden sm:inline text-xs text-muted-foreground shrink-0">
                        {assigneeName(c.assigned_to)}
                      </span>
                    )}
                  </div>
                )}
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
