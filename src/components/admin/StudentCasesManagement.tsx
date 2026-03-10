import React, { useState, useMemo, useEffect } from 'react';
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { guardedAction } from '@/lib/conflictPrevention';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTranslation } from 'react-i18next';
import { exportPDF } from '@/utils/exportUtils';
import { Search, FileText, User, Package, DollarSign, StickyNote, CheckCircle, Unlock } from 'lucide-react';
import PullToRefresh from '@/components/common/PullToRefresh';

interface StudentCasesManagementProps {
  cases: any[];
  leads: any[];
  lawyers: any[];
  influencers: any[];
  onRefresh: () => void;
  initialFilter?: string | null;
}

// Show cases that have progressed to submitted or enrollment_paid (canonical `cases` table statuses)
const READY_STATUSES = ['submitted', 'enrollment_paid'];

const StudentCasesManagement: React.FC<StudentCasesManagementProps> = ({ cases, leads, lawyers, influencers, onRefresh, initialFilter }) => {
  const { t } = useTranslation('dashboard');
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedCase, setSelectedCase] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingMoney, setEditingMoney] = useState(false);
  const [moneyValues, setMoneyValues] = useState<Record<string, number>>({});
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const [earlyReleaseId, setEarlyReleaseId] = useState<string | null>(null);
  const [releasedCases, setReleasedCases] = useState<Set<string>>(new Set());

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [search, statusFilter]);
  // Sync with external filter (funnel clicks)
  useEffect(() => { if (initialFilter) setStatusFilter(initialFilter); }, [initialFilter]);

  const studentCases = useMemo(() => {
    return cases
      .filter(c => READY_STATUSES.includes(c.status))
      .map(c => {
        // `cases` table uses assigned_to; look up the team member by that id
        const teamMember = c.assigned_to ? lawyers.find((l: any) => l.id === c.assigned_to) : null;
        const agent = c.partner_id ? influencers.find((i: any) => i.id === c.partner_id) : null;
        return { ...c, teamMember, agent };
      });
  }, [cases, lawyers, influencers]);

  const filtered = useMemo(() => {
    return studentCases.filter(c => {
      const name = c.full_name || '';
      const matchSearch = name.toLowerCase().includes(search.toLowerCase()) || (c.phone_number || '').includes(search);
      const matchStatus = statusFilter === 'all' || c.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [studentCases, search, statusFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const [payConfirmCaseId, setPayConfirmCaseId] = useState<string | null>(null);

  const executeMarkAsPaid = async (caseId: string) => {
    await guardedAction(`mark-case-paid-${caseId}`, async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');
        const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-mark-paid`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ case_id: caseId }),
        });
        const result = await resp.json();
        if (!resp.ok) throw new Error(result.error || 'Failed to mark paid');
        toast({ title: t('studentCases.markedPaid', { defaultValue: 'Case marked as paid — 20-day countdown started' }) });
        onRefresh();
      } catch (err: any) {
        toast({ variant: 'destructive', title: t('common.error'), description: err.message });
      }
      setLoading(false);
      setPayConfirmCaseId(null);
    });
  };

  const markAsPaid = (caseId: string) => {
    const existingCase = studentCases.find(c => c.id === caseId);
    if (existingCase?.status === 'enrollment_paid') {
      toast({ title: t('studentCases.alreadyPaid', { defaultValue: 'Already marked as paid' }) });
      return;
    }
    // Show 20-day confirmation modal
    setPayConfirmCaseId(caseId);
  };

  const getSourceBadge = (c: any) => {
    if (c.partner_id && c.agent) return <Badge variant="outline" className="text-[10px]">🤝 {c.agent.full_name}</Badge>;
    if (c.referred_by) return <Badge variant="outline" className="text-[10px]">👥 {t('lawyer.sources.referral')}</Badge>;
    return <Badge variant="outline" className="text-[10px]">🌐 {t('lawyer.sources.organic')}</Badge>;
  };

  // Net profit: service_fee + school_commission (all ILS) minus all expenses
  const getNetProfit = (c: any) => (c.service_fee || 0) + (c.school_commission || 0) - (c.influencer_commission || 0) - (c.lawyer_commission || 0) - (c.referral_discount || 0);

  const bulkExportPDF = () => {
    const headers = [t('admin.ready.fullName', 'Full Name'), t('admin.ready.email', 'Email'), t('admin.ready.phone', 'Phone'), t('admin.ready.passportNumber', 'Passport'), t('admin.ready.nationality', 'Nationality'), t('admin.ready.destinationCity', 'City'), t('admin.ready.schoolLabel', 'School'), t('admin.ready.intensiveCourse', 'Course'), t('admin.students.status', 'Status')];
                   const rows = filtered.map(c => [
      c.full_name || '', '', c.phone_number || '',
      c.passport_type || '', '', c.city || '', '', '',
      String(t(`cases.statuses.${c.status}`, { defaultValue: c.status })),
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
        {paginated.map(c => {
          const name = c.full_name || '—';
          const isPaid = c.status === 'enrollment_paid';
          const noLawyer = !c.assigned_to;
          // 20-day countdown — use rewards created_at as the unlock reference
          const countdownInfo = (() => {
            if (!isPaid || !c.updated_at) return null;
            const start = new Date(c.updated_at);
            const unlock = new Date(start.getTime() + 20 * 24 * 60 * 60 * 1000);
            const now = new Date();
            if (now >= unlock) return { locked: false, daysLeft: 0 };
            const daysLeft = Math.ceil((unlock.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
            return { locked: true, daysLeft };
          })();
          return (
            <Card key={c.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedCase(c)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-sm">{name}</h3>
                      {getSourceBadge(c)}
                      {noLawyer && <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700 bg-amber-50">⚠ {t('cases.noLawyer', { defaultValue: 'Unassigned' })}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {c.teamMember ? `${t('cases.teamMemberLabel')} ${c.teamMember.full_name}` : t('cases.notAssigned')}
                      {c.selected_city ? ` • ${c.selected_city}` : ''}{c.selected_school ? ` • ${c.selected_school}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <Badge variant={isPaid ? 'default' : 'secondary'}>{String(t(`cases.statuses.${c.status}`, { defaultValue: c.status }))}</Badge>
                    {releasedCases.has(c.id) ? (
                      <Badge variant="outline" className="text-[10px] border-emerald-400 text-emerald-700 bg-emerald-50">✅ {t('cases.paidOut', { defaultValue: 'Paid Out' })}</Badge>
                    ) : countdownInfo && (
                      countdownInfo.locked ? (
                        <>
                          <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-700 bg-amber-50">🔒 {countdownInfo.daysLeft}d</Badge>
                          <Button size="sm" variant="outline" className="h-6 text-[10px] border-emerald-400 text-emerald-700" onClick={(e) => { e.stopPropagation(); setEarlyReleaseId(c.id); }} disabled={loading}>
                            <Unlock className="h-3 w-3 me-1" />{t('cases.releaseEarly', { defaultValue: 'Release Early' })}
                          </Button>
                        </>
                      ) : (
                        <Badge variant="outline" className="text-[10px] border-emerald-400 text-emerald-700 bg-emerald-50">✅ {t('cases.payoutReady', { defaultValue: 'Payout Ready' })}</Badge>
                      )
                    )}
                    {['submitted', 'profile_completion'].includes(c.status) && !isPaid && (
                      <Button size="sm" onClick={() => markAsPaid(c.id)} disabled={loading}>
                        <CheckCircle className="h-3 w-3 me-1" />{t('studentCases.markPaid', { defaultValue: 'Mark Paid' })}
                      </Button>
                    )}
                  </div>
                </div>
                {isPaid && (
                  <div className="mt-2 flex gap-3 text-xs text-muted-foreground flex-wrap">
                    <span>{t('cases.serviceFee')}: {c.service_fee} ₪</span>
                    <span>{t('cases.netProfit')}: <span className={getNetProfit(c) >= 0 ? 'text-emerald-700 font-bold' : 'text-red-600 font-bold'}>{getNetProfit(c)} ₪</span></span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <div className="py-16 text-center">
            <Package className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground font-medium">{t('studentCases.noCases', { defaultValue: 'No student cases at this stage' })}</p>
            <p className="text-xs text-muted-foreground/60 mt-1">{t('studentCases.noCasesDesc', { defaultValue: 'Cases will appear here as they progress' })}</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious onClick={() => setPage(p => Math.max(1, p - 1))} aria-disabled={page === 1} className={page === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'} />
            </PaginationItem>
            <PaginationItem>
              <span className="px-4 py-2 text-sm text-muted-foreground">{page} / {totalPages}</span>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext onClick={() => setPage(p => Math.min(totalPages, p + 1))} aria-disabled={page === totalPages} className={page === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'} />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

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
                    { label: t('admin.ready.fullName'), value: selectedCase.full_name },
                    { label: t('admin.ready.phone'), value: selectedCase.phone_number },
                    { label: t('admin.ready.passportType'), value: selectedCase.passport_type },
                    { label: t('admin.ready.city'), value: selectedCase.city },
                    { label: t('admin.ready.educationLevel', { defaultValue: 'Education Level' }), value: selectedCase.education_level },
                    { label: t('admin.ready.englishLevel', { defaultValue: 'English Level' }), value: selectedCase.english_level },
                    { label: t('admin.ready.degreeInterest', { defaultValue: 'Degree Interest' }), value: selectedCase.degree_interest },
                    { label: t('admin.ready.intakeNotes', { defaultValue: 'Intake Notes' }), value: selectedCase.intake_notes },
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
                        <span>{t('cases.schoolComm')}</span><span className="font-semibold text-emerald-700">{selectedCase.school_commission} ₪</span>
                      </div>
                      {selectedCase.housing_description && (
                        <div className="flex justify-between p-2 bg-blue-50 rounded border border-blue-200">
                          <span>{t('cases.housingDesc', { defaultValue: 'Housing Type' })}</span>
                          <span className="font-semibold text-blue-700">{selectedCase.housing_description}</span>
                        </div>
                      )}
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
                        <span>{t('cases.schoolComm')}</span><span className="font-semibold text-emerald-700">{selectedCase.school_commission} ₪</span>
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
                    </div>
                    <div className={`mt-3 flex justify-between p-3 rounded-xl font-bold text-base ${getNetProfit(selectedCase) >= 0 ? 'bg-emerald-100 border border-emerald-300' : 'bg-red-100 border border-red-300'}`}>
                      <span>{t('cases.netProfit')}</span>
                      <span className={getNetProfit(selectedCase) >= 0 ? 'text-emerald-700' : 'text-red-600'}>{getNetProfit(selectedCase)} ₪</span>
                    </div>
                    <Button variant="outline" size="sm" className="mt-3" onClick={() => {
                      setEditingMoney(true);
                      setMoneyValues({
                        service_fee: Number(selectedCase.service_fee) || 4000,
                        school_commission: selectedCase.school_commission || 0,
                        influencer_commission: selectedCase.influencer_commission || 0,
                        lawyer_commission: selectedCase.lawyer_commission || 0,
                        referral_discount: selectedCase.referral_discount || 0,
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
                        await guardedAction(`update-financials-${selectedCase.id}`, async () => {
                          setLoading(true);
                          const { error } = await (supabase as any).from('student_cases').update(moneyValues).eq('id', selectedCase.id);
                          if (error) {
                            toast({ variant: 'destructive', title: t('common.error'), description: error.message });
                          } else {
                            // Sync reward rows when case is already paid — keeps influencer/lawyer dashboards accurate.
                            // Only touches pending/approved rewards (never already-paid ones).
                            if (selectedCase.case_status === 'paid') {
                              if (moneyValues.influencer_commission !== selectedCase.influencer_commission) {
                                await (supabase as any)
                                  .from('rewards')
                                  .update({ amount: moneyValues.influencer_commission })
                                  .like('admin_notes', `%${selectedCase.id}%`)
                                  .not('admin_notes', 'like', '%lawyer%')
                                  .not('admin_notes', 'like', '%translation%')
                                  .in('status', ['pending', 'approved']);
                              }
                              if (moneyValues.lawyer_commission !== selectedCase.lawyer_commission) {
                                await (supabase as any)
                                  .from('rewards')
                                  .update({ amount: moneyValues.lawyer_commission })
                                  .like('admin_notes', `%lawyer commission from case ${selectedCase.id}%`)
                                  .in('status', ['pending', 'approved']);
                              }
                            }
                            toast({ title: t('studentCases.financialsSaved', { defaultValue: 'Financials updated' }) });
                            setSelectedCase({ ...selectedCase, ...moneyValues });
                            setEditingMoney(false);
                            onRefresh();
                          }
                          setLoading(false);
                        });
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

      {/* 20-Day Payment Confirmation Modal */}
      <Dialog open={!!payConfirmCaseId} onOpenChange={() => setPayConfirmCaseId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('studentCases.confirmPayTitle', { defaultValue: '⚠️ Confirm Payment' })}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>{t('studentCases.confirmPayDesc', { defaultValue: 'This will start a 20-day payout countdown. After 20 days, the influencer and team member will be eligible to request their commission payout.' })}</p>
            {payConfirmCaseId && (() => {
              const pc = studentCases.find(c => c.id === payConfirmCaseId);
              const payoutDate = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
              return (
                <div className="p-3 bg-muted/50 rounded-lg space-y-1">
                  <p><strong>{t('studentCases.studentLabel', { defaultValue: 'Student' })}:</strong> {pc?.student_full_name || pc?.lead?.full_name || '—'}</p>
                  <p><strong>{t('studentCases.payoutEligible', { defaultValue: 'Payout eligible after' })}:</strong> {payoutDate.toLocaleDateString()}</p>
                </div>
              );
            })()}
          </div>
          <div className="flex gap-2 justify-end mt-2">
            <Button variant="outline" onClick={() => setPayConfirmCaseId(null)}>{t('common.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button onClick={() => payConfirmCaseId && executeMarkAsPaid(payConfirmCaseId)} disabled={loading}>
              <CheckCircle className="h-4 w-4 me-1" />{loading ? t('common.loading', { defaultValue: 'Loading...' }) : t('studentCases.confirmPay', { defaultValue: 'Confirm & Mark Paid' })}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Early Release Confirmation Modal */}
      <Dialog open={!!earlyReleaseId} onOpenChange={() => setEarlyReleaseId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('cases.earlyReleaseTitle', { defaultValue: '⚡ Release Payout Early' })}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>{t('cases.earlyReleaseDesc', { defaultValue: 'This will immediately mark all rewards for this case as paid. The influencer and team member will see "Paid Out" status.' })}</p>
            {earlyReleaseId && (() => {
              const rc = studentCases.find(c => c.id === earlyReleaseId);
              return (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p><strong>{t('studentCases.studentLabel', { defaultValue: 'Student' })}:</strong> {rc?.student_full_name || rc?.lead?.full_name || '—'}</p>
                </div>
              );
            })()}
          </div>
          <div className="flex gap-2 justify-end mt-2">
            <Button variant="outline" onClick={() => setEarlyReleaseId(null)}>{t('common.cancel', { defaultValue: 'Cancel' })}</Button>
            <Button onClick={async () => {
              if (!earlyReleaseId) return;
              await guardedAction(`early-release-${earlyReleaseId}`, async () => {
                setLoading(true);
                try {
                  const { data: { session } } = await supabase.auth.getSession();
                  if (!session) throw new Error('Not authenticated');
                  const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-early-release`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                    body: JSON.stringify({ case_id: earlyReleaseId }),
                  });
                  const result = await resp.json();
                  if (!resp.ok) throw new Error(result.error || 'Failed');
                  toast({ title: t('cases.earlyReleaseSuccess', { defaultValue: 'Payout released successfully' }) });
                  setReleasedCases(prev => new Set([...prev, earlyReleaseId]));
                  onRefresh();
                } catch (err: any) {
                  toast({ variant: 'destructive', title: t('common.error'), description: err.message });
                }
                setLoading(false);
                setEarlyReleaseId(null);
              });
            }} disabled={loading}>
              <Unlock className="h-4 w-4 me-1" />{loading ? t('common.loading', { defaultValue: 'Loading...' }) : t('cases.confirmRelease', { defaultValue: 'Confirm Release' })}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </PullToRefresh>
  );
};

export default StudentCasesManagement;
