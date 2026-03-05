import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { RefreshCw, Search, User, Clock, AlertTriangle } from 'lucide-react';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

const STATUSES = [
  'new', 'contacted', 'appointment_scheduled', 'profile_completion',
  'payment_confirmed', 'submitted', 'enrollment_paid',
];

const STATUS_LABELS: Record<string, { en: string; ar: string; color: string }> = {
  new:                   { en: 'New',                  ar: 'جديد',               color: 'bg-blue-100 text-blue-800 border-blue-200' },
  contacted:             { en: 'Contacted',             ar: 'تم التواصل',         color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  appointment_scheduled: { en: 'Appointment',           ar: 'موعد محدد',          color: 'bg-purple-100 text-purple-800 border-purple-200' },
  profile_completion:    { en: 'Profile',               ar: 'استكمال الملف',      color: 'bg-orange-100 text-orange-800 border-orange-200' },
  payment_confirmed:     { en: 'Payment Confirmed',     ar: 'تأكيد الدفع',        color: 'bg-teal-100 text-teal-800 border-teal-200' },
  submitted:             { en: 'Submitted',             ar: 'تم التقديم',         color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  enrollment_paid:       { en: 'Enrolled',              ar: 'مسجل',               color: 'bg-green-100 text-green-800 border-green-200' },
};

interface Case {
  id: string;
  full_name: string;
  phone_number: string;
  status: string;
  source: string;
  assigned_to: string | null;
  last_activity_at: string;
  created_at: string;
  is_no_show: boolean;
  assignee_name?: string;
}

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
}

const daysSince = (ts: string) => Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);

const AdminPipelinePage = () => {
  const { t, i18n } = useTranslation('dashboard');
  const { toast } = useToast();
  const isRtl = i18n.language === 'ar';

  const [cases, setCases] = useState<Case[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTeam, setFilterTeam] = useState('all');
  const [assigning, setAssigning] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      // Sequential fetch: first get team member IDs, then profiles
      const rolesRes = await supabase.from('user_roles').select('user_id').eq('role', 'team_member');
      const teamIds = (rolesRes.data ?? []).map(r => r.user_id);
      const [casesRes, profilesRes] = await Promise.all([
        supabase.from('cases').select('*').not('status', 'in', '("forgotten","cancelled")'),
        teamIds.length > 0
          ? supabase.from('profiles').select('id, full_name, email').in('id', teamIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (casesRes.error) throw casesRes.error;

      const profileMap: Record<string, string> = {};
      (profilesRes.data || []).forEach(p => { profileMap[p.id] = p.full_name; });

      const enriched = (casesRes.data || []).map(c => ({
        ...c,
        assignee_name: c.assigned_to ? profileMap[c.assigned_to] : undefined,
      }));

      setCases(enriched);
      setTeamMembers((profilesRes.data || []).map(p => ({ id: p.id, full_name: p.full_name, email: p.email || '' })));
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useRealtimeSubscription('cases', fetchData, true);

  const assignCase = async (caseId: string, userId: string | null) => {
    setAssigning(caseId);
    try {
      const { error } = await supabase.from('cases').update({ assigned_to: userId || null }).eq('id', caseId);
      if (error) throw error;
      await fetchData();
      toast({ description: isRtl ? 'تم التعيين بنجاح' : 'Case assigned' });
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setAssigning(null);
    }
  };

  const filtered = cases.filter(c => {
    const matchSearch = !search || c.full_name.toLowerCase().includes(search.toLowerCase()) || c.phone_number.includes(search);
    const matchTeam = filterTeam === 'all' || c.assigned_to === filterTeam || (filterTeam === 'unassigned' && !c.assigned_to);
    return matchSearch && matchTeam;
  });

  const getCasesForStatus = (status: string) => filtered.filter(c => c.status === status);

  const label = (status: string) => isRtl ? STATUS_LABELS[status]?.ar : STATUS_LABELS[status]?.en;

  return (
    <div className="p-6 space-y-4 max-w-full">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t('admin.pipeline.title', 'Application Pipeline')}</h1>
        <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
          <RefreshCw className="h-4 w-4" />{t('common.refresh', 'Refresh')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('admin.pipeline.searchPlaceholder', 'Search by name or phone...')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="ps-9"
          />
        </div>
        <Select value={filterTeam} onValueChange={setFilterTeam}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder={t('admin.pipeline.filterTeam', 'Filter by team member')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('admin.pipeline.allTeam', 'All')}</SelectItem>
            <SelectItem value="unassigned">{t('admin.pipeline.unassigned', 'Unassigned')}</SelectItem>
            {teamMembers.map(tm => (
              <SelectItem key={tm.id} value={tm.id}>{tm.full_name} — {tm.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Kanban */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {STATUSES.map(status => {
            const statusCases = getCasesForStatus(status);
            const meta = STATUS_LABELS[status];
            return (
              <div key={status} className="w-64 shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${meta.color}`}>
                    {label(status)}
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">{statusCases.length}</span>
                </div>
                <div className="space-y-2">
                  {loading ? (
                    Array.from({ length: 2 }).map((_, i) => (
                      <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
                    ))
                  ) : statusCases.length === 0 ? (
                    <div className="h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center">
                      <p className="text-xs text-muted-foreground">{t('admin.pipeline.empty', 'Empty')}</p>
                    </div>
                  ) : (
                     statusCases.map(c => {
                      const days = daysSince(c.last_activity_at);
                      const isRedStale = (status === 'new' && days >= 3) || c.is_no_show;
                      const isOrangeStale = !isRedStale && ((status === 'contacted' && days >= 5) || (status === 'appointment_scheduled' && days >= 14) || (status === 'profile_completion' && days >= 7));
                      const isStale = isRedStale || isOrangeStale;
                      const borderClass = isRedStale ? 'border-destructive/60' : isOrangeStale ? 'border-orange-400/60' : 'border-border';
                      const sourceMeta: Record<string, { label: string; cls: string }> = {
                        apply_page:    { label: isRtl ? 'تطبيق' : 'Apply', cls: 'bg-blue-100 text-blue-700' },
                        contact_form:  { label: isRtl ? 'نموذج' : 'Form',  cls: 'bg-yellow-100 text-yellow-700' },
                        manual:        { label: isRtl ? 'يدوي' : 'Manual', cls: 'bg-secondary text-secondary-foreground' },
                        submit_new_student: { label: isRtl ? 'تسجيل' : 'Enroll', cls: 'bg-purple-100 text-purple-700' },
                      };
                      const src = sourceMeta[c.source] ?? { label: c.source, cls: 'bg-muted text-muted-foreground' };
                      return (
                        <Card key={c.id} className={`cursor-pointer hover:shadow-sm transition-shadow ${borderClass}`}>
                          <CardContent className="p-3 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium text-foreground truncate">{c.full_name}</p>
                              <div className="flex items-center gap-1 shrink-0">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${src.cls}`}>{src.label}</span>
                                {isStale && <AlertTriangle className={`h-3.5 w-3.5 shrink-0 ${isRedStale ? 'text-destructive' : 'text-orange-500'}`} />}
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground">{c.phone_number}</p>
                            {/* Assignee */}
                            {c.assignee_name ? (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <User className="h-3 w-3" />{c.assignee_name}
                              </p>
                            ) : (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-medium">
                                {isRtl ? 'غير معيَّن' : 'Unassigned'}
                              </span>
                            )}
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {isRtl ? `${days} يوم` : `${days}d`}
                            </div>
                            {/* Assign dropdown */}
                            <Select
                              value={c.assigned_to || 'unassigned'}
                              onValueChange={val => assignCase(c.id, val === 'unassigned' ? null : val)}
                              disabled={assigning === c.id}
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <div className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  <SelectValue placeholder={t('admin.pipeline.assign', 'Assign')} />
                                </div>
                              </SelectTrigger>
                               <SelectContent>
                                 <SelectItem value="unassigned">{t('admin.pipeline.unassigned', 'Unassigned')}</SelectItem>
                                 {teamMembers.map(tm => (
                                   <SelectItem key={tm.id} value={tm.id}>
                                     {tm.full_name} — {tm.email}
                                   </SelectItem>
                                 ))}
                               </SelectContent>
                            </Select>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AdminPipelinePage;
