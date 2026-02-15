import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { Download, FileText, Eye, Save, UserPlus, Loader2, Copy, Check } from 'lucide-react';

interface ReadyCase {
  id: string;
  lead_id: string;
  selected_city: string | null;
  selected_school: string | null;
  accommodation_status: string | null;
  assigned_lawyer_id: string | null;
  paid_at: string | null;
  student_profile_id: string | null;
  // new expanded fields
  student_full_name: string | null;
  student_email: string | null;
  student_phone: string | null;
  student_address: string | null;
  student_age: number | null;
  language_proficiency: string | null;
  intensive_course: string | null;
  passport_number: string | null;
  nationality: string | null;
  country_of_birth: string | null;
  // joined from leads
  lead_name: string;
  ref_code: string | null;
  lead_phone: string | null;
  lead_email: string | null;
}

const ACCOMMODATION_OPTIONS = ['dorm', 'private_apartment', 'shared_flat', 'homestay', 'other'];

const ReadyToApplyTable: React.FC = () => {
  const { t, i18n } = useTranslation('dashboard');
  const { toast } = useToast();
  const [cases, setCases] = useState<ReadyCase[]>([]);
  const [lawyers, setLawyers] = useState<{ id: string; full_name: string }[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cityFilter, setCityFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [editCase, setEditCase] = useState<ReadyCase | null>(null);
  const [editValues, setEditValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [createdTempPassword, setCreatedTempPassword] = useState('');
  const [copiedPassword, setCopiedPassword] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: casesData } = await (supabase as any)
      .from('student_cases')
      .select('id, lead_id, selected_city, selected_school, accommodation_status, assigned_lawyer_id, paid_at, student_profile_id, student_full_name, student_email, student_phone, student_address, student_age, language_proficiency, intensive_course, passport_number, nationality, country_of_birth')
      .eq('case_status', 'ready_to_apply')
      .order('paid_at', { ascending: false });

    if (casesData && casesData.length > 0) {
      const leadIds = casesData.map((c: any) => c.lead_id);
      const { data: leadsData } = await (supabase as any)
        .from('leads')
        .select('id, full_name, ref_code, phone, email')
        .in('id', leadIds);

      const leadMap = new Map((leadsData || []).map((l: any) => [l.id, l]));
      const enriched = casesData.map((c: any) => {
        const lead = leadMap.get(c.lead_id) as any;
        return {
          ...c,
          lead_name: lead?.full_name || '—',
          ref_code: lead?.ref_code || '—',
          lead_phone: lead?.phone || null,
          lead_email: lead?.email || null,
        };
      });
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

  const openProfile = (c: ReadyCase) => {
    setEditCase(c);
    setEditValues({
      student_full_name: c.student_full_name || c.lead_name || '',
      student_email: c.student_email || c.lead_email || '',
      student_phone: c.student_phone || c.lead_phone || '',
      student_address: c.student_address || '',
      student_age: c.student_age || '',
      language_proficiency: c.language_proficiency || '',
      intensive_course: c.intensive_course || '',
      passport_number: c.passport_number || '',
      nationality: c.nationality || '',
      country_of_birth: c.country_of_birth || '',
      selected_city: c.selected_city || '',
      selected_school: c.selected_school || '',
      accommodation_status: c.accommodation_status || '',
    });
  };

  const saveProfile = async () => {
    if (!editCase) return;
    setSaving(true);
    const { error } = await (supabase as any).from('student_cases').update({
      student_full_name: editValues.student_full_name || null,
      student_email: editValues.student_email || null,
      student_phone: editValues.student_phone || null,
      student_address: editValues.student_address || null,
      student_age: editValues.student_age ? Number(editValues.student_age) : null,
      language_proficiency: editValues.language_proficiency || null,
      intensive_course: editValues.intensive_course || null,
      passport_number: editValues.passport_number || null,
      nationality: editValues.nationality || null,
      country_of_birth: editValues.country_of_birth || null,
      selected_city: editValues.selected_city || null,
      selected_school: editValues.selected_school || null,
      accommodation_status: editValues.accommodation_status || null,
    }).eq('id', editCase.id);

    setSaving(false);
    if (error) {
      toast({ variant: 'destructive', title: t('common.error'), description: error.message });
    } else {
      toast({ title: t('admin.ready.profileSaved') });
      setEditCase(null);
      fetchData();
    }
  };

  const createStudentAccount = async () => {
    if (!editCase) return;
    const email = editValues.student_email;
    const fullName = editValues.student_full_name;
    if (!email || !fullName) {
      toast({ variant: 'destructive', title: t('common.error'), description: t('admin.ready.emailRequired') });
      return;
    }

    setCreatingAccount(true);
    setCreatedTempPassword('');
    setCopiedPassword(false);
    try {
      await saveProfile();

      const res = await supabase.functions.invoke('create-student-account', {
        body: { case_id: editCase.id, email, full_name: fullName },
      });

      if (res.error) throw new Error(res.error.message || 'Failed to create account');
      const result = res.data;
      if (result?.error) throw new Error(result.error);

      setCreatedTempPassword(result?.temp_password || '');
      toast({ title: t('admin.ready.accountCreated'), description: 'شارك البيانات يدوياً مع الطالب' });
      fetchData();
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('common.error'), description: err.message });
    } finally {
      setCreatingAccount(false);
    }
  };

  const copyTempPassword = () => {
    if (createdTempPassword) {
      navigator.clipboard.writeText(createdTempPassword);
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2000);
    }
  };

  const exportCSV = () => {
    const rows = filtered.filter(c => selected.has(c.id));
    if (rows.length === 0) return;
    const locale = i18n.language === 'ar' ? 'ar' : 'en-US';
    const headers = [t('admin.ready.refCode'), t('admin.ready.name'), t('admin.ready.city'), t('admin.ready.school'), t('admin.ready.accommodation'), t('admin.ready.staff'), t('admin.ready.paymentDate')];
    const csvRows = rows.map(r => [
      r.ref_code || '', r.student_full_name || r.lead_name, r.selected_city || '', r.selected_school || '',
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
        <div className="bg-background rounded-xl border shadow-sm w-full overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="p-3 text-start"><Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} /></th>
                    <th className="p-3 text-start font-medium text-muted-foreground">{t('admin.ready.refCode')}</th>
                    <th className="p-3 text-start font-medium text-muted-foreground">{t('admin.ready.name')}</th>
                    <th className="p-3 text-start font-medium text-muted-foreground">{t('admin.ready.city')}</th>
                    <th className="p-3 text-start font-medium text-muted-foreground">{t('admin.ready.school')}</th>
                    <th className="p-3 text-start font-medium text-muted-foreground">{t('admin.ready.accommodation')}</th>
                    <th className="p-3 text-start font-medium text-muted-foreground">{t('admin.ready.staff')}</th>
                    <th className="p-3 text-start font-medium text-muted-foreground">{t('admin.ready.account')}</th>
                    <th className="p-3 text-start font-medium text-muted-foreground">{t('admin.ready.actions')}</th>
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
                      <td className="p-3 font-medium">{c.student_full_name || c.lead_name}</td>
                      <td className="p-3">{c.selected_city || '—'}</td>
                      <td className="p-3">{c.selected_school || '—'}</td>
                      <td className="p-3">{c.accommodation_status || '—'}</td>
                      <td className="p-3">{getTeamMemberName(c.assigned_lawyer_id)}</td>
                      <td className="p-3">
                        {c.student_profile_id ? (
                          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-[10px]">{t('admin.ready.active')}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">{t('admin.ready.noAccount')}</Badge>
                        )}
                      </td>
                      <td className="p-3">
                        <Button variant="ghost" size="sm" onClick={() => openProfile(c)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
        </div>
      )}

      {/* Profile Edit Modal */}
      <Dialog open={!!editCase} onOpenChange={(open) => !open && setEditCase(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('admin.ready.profileTitle')}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div>
              <Label>{t('admin.ready.fullName')}</Label>
              <Input value={editValues.student_full_name || ''} onChange={e => setEditValues(v => ({ ...v, student_full_name: e.target.value }))} />
            </div>
            <div>
              <Label>{t('admin.ready.email')}</Label>
              <Input type="email" value={editValues.student_email || ''} onChange={e => setEditValues(v => ({ ...v, student_email: e.target.value }))} />
            </div>
            <div>
              <Label>{t('admin.ready.phone')}</Label>
              <Input value={editValues.student_phone || ''} onChange={e => setEditValues(v => ({ ...v, student_phone: e.target.value }))} />
            </div>
            <div>
              <Label>{t('admin.ready.age')}</Label>
              <Input type="number" value={editValues.student_age || ''} onChange={e => setEditValues(v => ({ ...v, student_age: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <Label>{t('admin.ready.address')}</Label>
              <Input value={editValues.student_address || ''} onChange={e => setEditValues(v => ({ ...v, student_address: e.target.value }))} />
            </div>
            <div>
              <Label>{t('admin.ready.passportNumber')}</Label>
              <Input value={editValues.passport_number || ''} onChange={e => setEditValues(v => ({ ...v, passport_number: e.target.value }))} />
            </div>
            <div>
              <Label>{t('admin.ready.nationality')}</Label>
              <Input value={editValues.nationality || ''} onChange={e => setEditValues(v => ({ ...v, nationality: e.target.value }))} />
            </div>
            <div>
              <Label>{t('admin.ready.countryOfBirth')}</Label>
              <Input value={editValues.country_of_birth || ''} onChange={e => setEditValues(v => ({ ...v, country_of_birth: e.target.value }))} />
            </div>
            <div>
              <Label>{t('admin.ready.languageProficiency')}</Label>
              <Input value={editValues.language_proficiency || ''} onChange={e => setEditValues(v => ({ ...v, language_proficiency: e.target.value }))} placeholder="e.g. German B1, English C1" />
            </div>
            <div>
              <Label>{t('admin.ready.destinationCity')}</Label>
              <Input value={editValues.selected_city || ''} onChange={e => setEditValues(v => ({ ...v, selected_city: e.target.value }))} />
            </div>
            <div>
              <Label>{t('admin.ready.schoolLabel')}</Label>
              <Input value={editValues.selected_school || ''} onChange={e => setEditValues(v => ({ ...v, selected_school: e.target.value }))} />
            </div>
            <div>
              <Label>{t('admin.ready.intensiveCourse')}</Label>
              <Input value={editValues.intensive_course || ''} onChange={e => setEditValues(v => ({ ...v, intensive_course: e.target.value }))} />
            </div>
            <div>
              <Label>{t('admin.ready.accommodationType')}</Label>
              <Select value={editValues.accommodation_status || ''} onValueChange={v => setEditValues(ev => ({ ...ev, accommodation_status: v }))}>
                <SelectTrigger><SelectValue placeholder={t('admin.ready.selectAccommodation')} /></SelectTrigger>
                <SelectContent>
                  {ACCOMMODATION_OPTIONS.map(o => (
                    <SelectItem key={o} value={o}>{t(`admin.ready.accommodationTypes.${o}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 mt-4 pt-4 border-t">
            <Button onClick={saveProfile} disabled={saving}>
              <Save className="h-4 w-4 me-1" />{saving ? t('common.loading') : t('admin.ready.saveProfile')}
            </Button>
            {createdTempPassword && (
              <div className="md:col-span-2 bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3 mt-2">
                <p className="text-sm font-semibold text-amber-800">✅ تم إنشاء الحساب بنجاح</p>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">البريد الإلكتروني:</p>
                  <p className="text-sm font-mono bg-background border rounded px-2 py-1">{editValues.student_email}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">كلمة المرور المؤقتة:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm font-mono bg-background border rounded px-2 py-1 select-all">{createdTempPassword}</code>
                    <Button size="sm" variant="outline" onClick={copyTempPassword}>
                      {copiedPassword ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-amber-700 font-medium">⚠️ شارك هذه البيانات يدوياً مع الطالب (واتساب، رسالة مباشرة، إلخ)</p>
                <p className="text-xs text-muted-foreground">سيُطلب منه تغيير كلمة المرور عند أول تسجيل دخول.</p>
              </div>
            )}
            {!editCase?.student_profile_id && !createdTempPassword && (
              <Button variant="secondary" onClick={createStudentAccount} disabled={creatingAccount || !editValues.student_email}>
                {creatingAccount ? <Loader2 className="h-4 w-4 me-1 animate-spin" /> : <UserPlus className="h-4 w-4 me-1" />}
                {t('admin.ready.createAccount')}
              </Button>
            )}
            {editCase?.student_profile_id && !createdTempPassword && (
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 self-center px-3 py-1.5">
                {t('admin.ready.accountActive')}
              </Badge>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReadyToApplyTable;
