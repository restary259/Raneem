import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { Download, FileText } from 'lucide-react';

interface ReadyCase {
  id: string;
  lead_id: string;
  selected_city: string | null;
  selected_school: string | null;
  accommodation_status: string | null;
  assigned_lawyer_id: string | null;
  paid_at: string | null;
  lead_name: string;
  ref_code: string | null;
}

const ReadyToApplyTable: React.FC = () => {
  const { t, i18n } = useTranslation('dashboard');
  const [cases, setCases] = useState<ReadyCase[]>([]);
  const [lawyers, setLawyers] = useState<{ id: string; full_name: string }[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cityFilter, setCityFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: casesData } = await (supabase as any)
      .from('student_cases')
      .select('id, lead_id, selected_city, selected_school, accommodation_status, assigned_lawyer_id, paid_at')
      .eq('case_status', 'ready_to_apply')
      .order('paid_at', { ascending: false });

    if (casesData && casesData.length > 0) {
      const leadIds = casesData.map((c: any) => c.lead_id);
      const { data: leadsData } = await (supabase as any)
        .from('leads')
        .select('id, full_name, ref_code')
        .in('id', leadIds);

      const leadMap = new Map((leadsData || []).map((l: any) => [l.id, l]));
      const enriched = casesData.map((c: any) => ({
        ...c,
        lead_name: (leadMap.get(c.lead_id) as any)?.full_name || '—',
        ref_code: (leadMap.get(c.lead_id) as any)?.ref_code || '—',
      }));
      setCases(enriched);
    } else {
      setCases([]);
    }

    const { data: teamRoles } = await (supabase as any).from('user_roles').select('user_id').eq('role', 'lawyer');
    if (teamRoles && teamRoles.length > 0) {
      const { data: profiles } = await (supabase as any)
        .from('profiles')
        .select('id, full_name')
        .in('id', teamRoles.map((r: any) => r.user_id));
      if (profiles) setLawyers(profiles);
    }
    setLoading(false);
  };

  const getTeamMemberName = (id: string | null) => id ? lawyers.find(l => l.id === id)?.full_name || '—' : '—';

  const cities = [...new Set(cases.map(c => c.selected_city).filter(Boolean))] as string[];

  const filtered = cases.filter(c => cityFilter === 'all' || c.selected_city === cityFilter);

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(c => c.id)));
  };

  const exportCSV = () => {
    const rows = filtered.filter(c => selected.has(c.id));
    if (rows.length === 0) return;
    const locale = i18n.language === 'ar' ? 'ar' : 'en-US';
    const headers = [t('admin.ready.refCode'), t('admin.ready.name'), t('admin.ready.city'), t('admin.ready.school'), t('admin.ready.accommodation'), t('admin.ready.staff'), t('admin.ready.paymentDate')];
    const csvRows = rows.map(r => [
      r.ref_code || '', r.lead_name, r.selected_city || '', r.selected_school || '',
      r.accommodation_status || '', getTeamMemberName(r.assigned_lawyer_id),
      r.paid_at ? new Date(r.paid_at).toLocaleDateString(locale) : '',
    ]);
    const csv = [headers.join(','), ...csvRows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'ready-to-apply.csv'; a.click();
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
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="p-3 text-start">
                      <Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} />
                    </th>
                    <th className="p-3 text-start font-medium text-muted-foreground">{t('admin.ready.refCode')}</th>
                    <th className="p-3 text-start font-medium text-muted-foreground">{t('admin.ready.name')}</th>
                    <th className="p-3 text-start font-medium text-muted-foreground">{t('admin.ready.city')}</th>
                    <th className="p-3 text-start font-medium text-muted-foreground">{t('admin.ready.school')}</th>
                    <th className="p-3 text-start font-medium text-muted-foreground">{t('admin.ready.accommodation')}</th>
                    <th className="p-3 text-start font-medium text-muted-foreground">{t('admin.ready.staff')}</th>
                    <th className="p-3 text-start font-medium text-muted-foreground">{t('admin.ready.paymentDate')}</th>
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
                      <td className="p-3 font-mono text-xs">{c.ref_code}</td>
                      <td className="p-3 font-medium">{c.lead_name}</td>
                      <td className="p-3">{c.selected_city || '—'}</td>
                      <td className="p-3">{c.selected_school || '—'}</td>
                      <td className="p-3">{c.accommodation_status || '—'}</td>
                      <td className="p-3">{getTeamMemberName(c.assigned_lawyer_id)}</td>
                      <td className="p-3">{c.paid_at ? new Date(c.paid_at).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ReadyToApplyTable;
