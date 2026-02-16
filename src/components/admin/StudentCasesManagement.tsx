import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTranslation } from 'react-i18next';
import { exportPDF } from '@/utils/exportUtils';
import { Search, FileText, User, Package, DollarSign, StickyNote, CheckCircle } from 'lucide-react';
import PullToRefresh from '@/components/common/PullToRefresh';

interface StudentCasesManagementProps {
  cases: any[];
  leads: any[];
  lawyers: any[];
  influencers: any[];
  onRefresh: () => void;
}

const READY_STATUSES = ['services_filled', 'paid', 'ready_to_apply', 'registration_submitted', 'visa_stage', 'completed'];

const StudentCasesManagement: React.FC<StudentCasesManagementProps> = ({ cases, leads, lawyers, influencers, onRefresh }) => {
  const { t } = useTranslation('dashboard');
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedCase, setSelectedCase] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingMoney, setEditingMoney] = useState(false);
  const [moneyValues, setMoneyValues] = useState<Record<string, number>>({});

  const studentCases = useMemo(() => {
    return cases
      .filter(c => READY_STATUSES.includes(c.case_status))
      .map(c => {
        const lead = leads.find(l => l.id === c.lead_id);
        const teamMember = c.assigned_lawyer_id ? lawyers.find(l => l.id === c.assigned_lawyer_id) : null;
        const agent = lead?.source_type === 'influencer' && lead?.source_id ? influencers.find(i => i.id === lead.source_id) : null;
        return { ...c, lead, teamMember, agent };
      });
  }, [cases, leads, lawyers, influencers]);

  const filtered = useMemo(() => {
    return studentCases.filter(c => {
      const name = c.student_full_name || c.lead?.full_name || '';
      const matchSearch = name.toLowerCase().includes(search.toLowerCase()) || (c.student_phone || c.lead?.phone || '').includes(search);
      const matchStatus = statusFilter === 'all' || c.case_status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [studentCases, search, statusFilter]);

  const markAsPaid = async (caseId: string) => {
    setLoading(true);
    const { error } = await (supabase as any).from('student_cases').update({ case_status: 'paid', paid_at: new Date().toISOString() }).eq('id', caseId);
    if (error) { toast({ variant: 'destructive', title: t('common.error'), description: error.message }); }
    else { toast({ title: t('studentCases.markedPaid', { defaultValue: 'Case marked as paid' }) }); onRefresh(); }
    setLoading(false);
  };

  const getSourceBadge = (c: any) => {
    const lead = c.lead;
    if (!lead) return null;
    if (lead.source_type === 'influencer' && c.agent) return <Badge variant="outline" className="text-[10px]">🤝 {c.agent.full_name}</Badge>;
    if (lead.source_type === 'referral') return <Badge variant="outline" className="text-[10px]">👥 {t('lawyer.sources.referral')}</Badge>;
    return <Badge variant="outline" className="text-[10px]">🌐 {t('lawyer.sources.organic')}</Badge>;
  };

  const getNetProfit = (c: any) => (c.service_fee || 0) + (c.school_commission || 0) - (c.influencer_commission || 0) - (c.lawyer_commission || 0) - (c.referral_discount || 0) - (c.translation_fee || 0);

  const bulkExportPDF = () => {
    const headers = [t('admin.ready.fullName', 'Full Name'), t('admin.ready.email', 'Email'), t('admin.ready.phone', 'Phone'), t('admin.ready.passportNumber', 'Passport'), t('admin.ready.nationality', 'Nationality'), t('admin.ready.destinationCity', 'City'), t('admin.ready.schoolLabel', 'School'), t('admin.ready.intensiveCourse', 'Course'), t('admin.students.status', 'Status')];
    const rows = filtered.map(c => [
      c.student_full_name || c.lead?.full_name || '', c.student_email || c.lead?.email || '', c.student_phone || c.lead?.phone || '',
      c.passport_number || '', c.nationality || '', c.selected_city || '', c.selected_school || '', c.intensive_course || '',
      String(t(`cases.statuses.${c.case_status}`, { defaultValue: c.case_status })),
    ]);
    exportPDF({ headers, rows, fileName: `student-intake-${new Date().toISOString().slice(0, 10)}`, title: 'Darb Study International — Student Intake' });
  };

  return (
    <PullToRefresh onRefresh={async () => { onRefresh(); }} disabled={loading}>
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-1 w-full sm:w-auto flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t('admin.leads.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} className="ps-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('admin.leads.all')}</SelectItem>
              {READY_STATUSES.map(s => <SelectItem key={s} value={s}>{String(t(`cases.statuses.${s}`, { defaultValue: s }))}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={bulkExportPDF}><FileText className="h-4 w-4 me-1" />{t('studentCases.bulkPDF', { defaultValue: 'Bulk PDF Export' })}</Button>
      </div>

      <p className="text-sm text-muted-foreground">{filtered.length} {t('studentCases.casesCount', { defaultValue: 'student cases' })}</p>

      <div className="space-y-3">
        {filtered.map(c => {
          const name = c.student_full_name || c.lead?.full_name || '—';
          const isPaid = c.case_status === 'paid' || !!c.paid_at;
          return (
            <Card key={c.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedCase(c)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-sm">{name}</h3>
                      {getSourceBadge(c)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {c.teamMember ? `${t('cases.teamMemberLabel')} ${c.teamMember.full_name}` : t('cases.notAssigned')}
                      {c.selected_city ? ` • ${c.selected_city}` : ''}{c.selected_school ? ` • ${c.selected_school}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <Badge variant={isPaid ? 'default' : 'secondary'}>{String(t(`cases.statuses.${c.case_status}`, { defaultValue: c.case_status }))}</Badge>
                    {c.case_status === 'services_filled' && (
                      <Button size="sm" onClick={() => markAsPaid(c.id)} disabled={loading}>
                        <CheckCircle className="h-3 w-3 me-1" />{t('studentCases.markPaid', { defaultValue: 'Mark Paid' })}
                      </Button>
                    )}
                  </div>
                </div>
                {isPaid && (
                  <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
                    <span>{t('cases.serviceFee')}: {c.service_fee} ₪</span>
                    <span>{t('cases.netProfit')}: <span className={getNetProfit(c) >= 0 ? 'text-emerald-700 font-bold' : 'text-red-600 font-bold'}>{getNetProfit(c)} ₪</span></span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && <p className="p-8 text-center text-muted-foreground">{t('studentCases.noCases', { defaultValue: 'No student cases at this stage' })}</p>}
      </div>

      {/* Case Detail Dialog */}
      <Dialog open={!!selectedCase} onOpenChange={() => setSelectedCase(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedCase?.student_full_name || selectedCase?.lead?.full_name || '—'}</DialogTitle>
          </DialogHeader>
          {selectedCase && (
            <Tabs defaultValue="profile" className="mt-2">
              <TabsList className="w-full">
                <TabsTrigger value="profile" className="flex-1"><User className="h-3 w-3 me-1" />{t('studentCases.profile', { defaultValue: 'Profile' })}</TabsTrigger>
                <TabsTrigger value="services" className="flex-1"><Package className="h-3 w-3 me-1" />{t('studentCases.services', { defaultValue: 'Services' })}</TabsTrigger>
                <TabsTrigger value="money" className="flex-1"><DollarSign className="h-3 w-3 me-1" />{t('studentCases.money', { defaultValue: 'Money' })}</TabsTrigger>
                <TabsTrigger value="notes" className="flex-1"><StickyNote className="h-3 w-3 me-1" />{t('studentCases.notes', { defaultValue: 'Notes' })}</TabsTrigger>
              </TabsList>

              <TabsContent value="profile" className="space-y-3 mt-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { label: t('admin.ready.fullName'), value: selectedCase.student_full_name || selectedCase.lead?.full_name },
                    { label: t('admin.ready.email'), value: selectedCase.student_email || selectedCase.lead?.email },
                    { label: t('admin.ready.phone'), value: selectedCase.student_phone || selectedCase.lead?.phone },
                    { label: t('admin.ready.age'), value: selectedCase.student_age },
                    { label: t('admin.ready.passportNumber'), value: selectedCase.passport_number },
                    { label: t('admin.ready.nationality'), value: selectedCase.nationality },
                    { label: t('admin.ready.countryOfBirth'), value: selectedCase.country_of_birth },
                    { label: t('admin.ready.address'), value: selectedCase.student_address },
                    { label: t('admin.ready.languageProficiency'), value: selectedCase.language_proficiency },
                    { label: t('admin.ready.destinationCity'), value: selectedCase.selected_city },
                    { label: t('admin.ready.schoolLabel'), value: selectedCase.selected_school },
                    { label: t('admin.ready.intensiveCourse'), value: selectedCase.intensive_course },
                  ].map((item, i) => (
                    <div key={i} className="p-2 bg-muted/30 rounded">
                      <p className="text-[10px] text-muted-foreground">{String(item.label)}</p>
                      <p className="font-medium">{item.value || '—'}</p>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="services" className="mt-4">
                <p className="text-xs text-muted-foreground mb-2">{t('studentCases.servicesReadOnly', { defaultValue: 'Services are assigned by the team member (read-only).' })}</p>
                <div className="space-y-2">
                  {(selectedCase.service_fee > 0 || selectedCase.school_commission > 0) ? (
                    <div className="grid grid-cols-1 gap-2 text-sm">
                      <div className="flex justify-between p-2 bg-emerald-50 rounded border border-emerald-200">
                        <span>{t('cases.serviceFee')}</span><span className="font-semibold text-emerald-700">{selectedCase.service_fee} ₪</span>
                      </div>
                      <div className="flex justify-between p-2 bg-emerald-50 rounded border border-emerald-200">
                        <span>{t('cases.schoolComm')}</span><span className="font-semibold text-emerald-700">{selectedCase.school_commission} €</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">{t('studentCases.noServices', { defaultValue: 'No services attached yet' })}</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="money" className="mt-4">
                {!editingMoney ? (
                  <>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex justify-between p-2 bg-emerald-50 rounded border border-emerald-200">
                        <span>{t('cases.serviceFee')}</span><span className="font-semibold text-emerald-700">{selectedCase.service_fee} ₪</span>
                      </div>
                      <div className="flex justify-between p-2 bg-emerald-50 rounded border border-emerald-200">
                        <span>{t('cases.schoolComm')}</span><span className="font-semibold text-emerald-700">{selectedCase.school_commission} €</span>
                      </div>
                      <div className="flex justify-between p-2 bg-red-50 rounded border border-red-200">
                        <span>{t('cases.agentComm')}</span><span className="font-semibold text-red-700">-{selectedCase.influencer_commission} ₪</span>
                      </div>
                      <div className="flex justify-between p-2 bg-red-50 rounded border border-red-200">
                        <span>{t('cases.teamMemberComm')}</span><span className="font-semibold text-red-700">-{selectedCase.lawyer_commission} ₪</span>
                      </div>
                      <div className="flex justify-between p-2 bg-red-50 rounded border border-red-200">
                        <span>{t('cases.referralDiscount')}</span><span className="font-semibold text-red-700">-{selectedCase.referral_discount} ₪</span>
                      </div>
                      <div className="flex justify-between p-2 bg-red-50 rounded border border-red-200">
                        <span>{t('cases.translationFee')}</span><span className="font-semibold text-red-700">-{selectedCase.translation_fee} ₪</span>
                      </div>
                    </div>
                    <div className={`mt-3 flex justify-between p-3 rounded-xl font-bold text-base ${getNetProfit(selectedCase) >= 0 ? 'bg-emerald-100 border border-emerald-300' : 'bg-red-100 border border-red-300'}`}>
                      <span>{t('cases.netProfit')}</span>
                      <span className={getNetProfit(selectedCase) >= 0 ? 'text-emerald-700' : 'text-red-600'}>{getNetProfit(selectedCase)} ₪</span>
                    </div>
                    <Button variant="outline" size="sm" className="mt-3" onClick={() => {
                      setEditingMoney(true);
                      setMoneyValues({
                        service_fee: selectedCase.service_fee || 0,
                        school_commission: selectedCase.school_commission || 0,
                        influencer_commission: selectedCase.influencer_commission || 0,
                        lawyer_commission: selectedCase.lawyer_commission || 0,
                        referral_discount: selectedCase.referral_discount || 0,
                        translation_fee: selectedCase.translation_fee || 0,
                      });
                    }}>
                      <DollarSign className="h-3 w-3 me-1" />{t('studentCases.editFinancials', { defaultValue: 'Edit Financials' })}
                    </Button>
                  </>
                ) : (
                  <div className="space-y-3">
                    {[
                      { key: 'service_fee', label: t('cases.serviceFee') },
                      { key: 'school_commission', label: t('cases.schoolComm') },
                      { key: 'influencer_commission', label: t('cases.agentComm') },
                      { key: 'lawyer_commission', label: t('cases.teamMemberComm') },
                      { key: 'referral_discount', label: t('cases.referralDiscount') },
                      { key: 'translation_fee', label: t('cases.translationFee') },
                    ].map(field => (
                      <div key={field.key} className="flex items-center gap-2">
                        <label className="text-sm w-40 shrink-0">{field.label}</label>
                        <Input
                          type="number"
                          value={moneyValues[field.key] || 0}
                          onChange={e => setMoneyValues(v => ({ ...v, [field.key]: Number(e.target.value) }))}
                          className="w-32"
                        />
                      </div>
                    ))}
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" disabled={loading} onClick={async () => {
                        setLoading(true);
                        const { error } = await (supabase as any).from('student_cases').update(moneyValues).eq('id', selectedCase.id);
                        if (error) {
                          toast({ variant: 'destructive', title: t('common.error'), description: error.message });
                        } else {
                          toast({ title: t('studentCases.financialsSaved', { defaultValue: 'Financials updated' }) });
                          setSelectedCase({ ...selectedCase, ...moneyValues });
                          setEditingMoney(false);
                          onRefresh();
                        }
                        setLoading(false);
                      }}>
                        <CheckCircle className="h-3 w-3 me-1" />{t('common.save', { defaultValue: 'Save' })}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingMoney(false)}>{t('common.cancel', { defaultValue: 'Cancel' })}</Button>
                    </div>
                  </div>
                )}
                {selectedCase.lead?.source_type === 'influencer' && selectedCase.agent && (
                  <p className="text-xs text-muted-foreground mt-2">🤝 {t('studentCases.agentNote', { name: selectedCase.agent.full_name, amount: selectedCase.influencer_commission, defaultValue: 'Agent: {{name}} — Commission: {{amount}} ₪' })}</p>
                )}
                {selectedCase.referral_discount > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">👥 {t('studentCases.referralNote', { amount: selectedCase.referral_discount, defaultValue: 'Referral discount applied: {{amount}} ₪' })}</p>
                )}
              </TabsContent>

              <TabsContent value="notes" className="mt-4">
                <p className="text-sm">{selectedCase.notes || t('studentCases.noNotes', { defaultValue: 'No internal notes.' })}</p>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
    </PullToRefresh>
  );
};

export default StudentCasesManagement;
