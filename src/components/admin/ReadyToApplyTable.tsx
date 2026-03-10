import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { Download, FileText, Eye } from 'lucide-react';

interface ReadyCase {
  id: string;
  full_name: string;
  phone_number: string;
  city: string | null;
  status: string;
  assigned_to: string | null;
  source: string;
  created_at: string;
  updated_at: string;
  student_user_id: string | null;
}

const ReadyToApplyTable: React.FC = () => {
  const { t, i18n } = useTranslation('dashboard');
  const { toast } = useToast();
  const [cases, setCases] = useState<ReadyCase[]>([]);
  const [teamMembers, setTeamMembers] = useState<{ id: string; full_name: string }[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cityFilter, setCityFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: casesData, error } = await (supabase as any)
      .from('cases')
      .select('id, full_name, phone_number, city, status, assigned_to, source, created_at, updated_at, student_user_id')
      .eq('status', 'enrollment_paid')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });

    if (error) {
      toast({ variant: 'destructive', title: t('common.error'), description: error.message });
    } else {
      setCases(casesData || []);
    }

    const { data: teamRoles } = await (supabase as any).from('user_roles').select('user_id').eq('role', 'team_member');
    if (teamRoles && teamRoles.length > 0) {
      const { data: profiles } = await (supabase as any)
        .from('profiles')
        .select('id, full_name')
        .in('id', teamRoles.map((r: any) => r.user_id));
      if (profiles) setTeamMembers(profiles);
    }
    setLoading(false);
  };

  const getTeamMemberName = (id: string | null) => id ? teamMembers.find(l => l.id === id)?.full_name || '—' : '—';

  const cities = [...new Set(cases.map(c => c.city).filter(Boolean))] as string[];
  const filtered = cases.filter(c => cityFilter === 'all' || c.city === cityFilter);

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(c => c.id)));
  };

  const exportCSV = () => {
    const rows = filtered.filter(c => selected.has(c.id));
    if (rows.length === 0) return;
    const locale = i18n.language === 'ar' ? 'ar' : 'en-US';
    const headers = [t('admin.ready.name'), t('admin.ready.phone', 'Phone'), t('admin.ready.city'), t('admin.ready.staff'), 'Source', t('admin.ready.paymentDate')];
    const csvRows = rows.map(r => [
      r.full_name, r.phone_number, r.city || '', getTeamMemberName(r.assigned_to), r.source,
      new Date(r.updated_at).toLocaleDateString(locale),
    ]);
    const csv = [headers.join(','), ...csvRows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'enrolled-cases.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <p className="text-center text-muted-foreground py-8">{t('common.loading')}</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 items-center">
          <Select value={cityFilter} onValueChange={setCityFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder={t('admin.ready.filterCity')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('admin.leads.all')}</SelectItem>
              {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">{t('admin.ready.count', { count: filtered.length })}</span>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={selected.size === 0}>
          <Download className="h-4 w-4 me-1" />{t('admin.ready.exportForSchool')} ({selected.size})
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>{t('admin.ready.noResults')}</p>
        </div>
      ) : (
        <Card className="w-full overflow-hidden">
          <div className="w-full overflow-x-auto">
            <table className="w-full table-fixed text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="w-[4%] p-3 text-start"><Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} /></th>
                  <th className="w-[20%] p-3 text-start font-medium text-muted-foreground">{t('admin.ready.name')}</th>
                  <th className="w-[15%] p-3 text-start font-medium text-muted-foreground">{t('admin.ready.phone', 'Phone')}</th>
                  <th className="w-[12%] p-3 text-start font-medium text-muted-foreground">{t('admin.ready.city')}</th>
                  <th className="w-[14%] p-3 text-start font-medium text-muted-foreground">{t('admin.ready.staff')}</th>
                  <th className="w-[10%] p-3 text-start font-medium text-muted-foreground">{t('admin.ready.account')}</th>
                  <th className="w-[12%] p-3 text-start font-medium text-muted-foreground">{t('admin.ready.paymentDate')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="p-3">
                      <Checkbox
                        checked={selected.has(c.id)}
                        onCheckedChange={() => {
                          const next = new Set(selected);
                          next.has(c.id) ? next.delete(c.id) : next.add(c.id);
                          setSelected(next);
                        }}
                      />
                    </td>
                    <td className="p-3 font-medium">{c.full_name}</td>
                    <td className="p-3 text-muted-foreground">{c.phone_number}</td>
                    <td className="p-3">{c.city || '—'}</td>
                    <td className="p-3">{getTeamMemberName(c.assigned_to)}</td>
                    <td className="p-3">
                      {c.student_user_id ? (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-[10px]">{t('admin.ready.active')}</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">{t('admin.ready.noAccount')}</Badge>
                      )}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {new Date(c.updated_at).toLocaleDateString(i18n.language === 'ar' ? 'ar' : 'en-US')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

export default ReadyToApplyTable;
