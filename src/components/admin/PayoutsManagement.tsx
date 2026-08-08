import React, { useEffect, useState, useMemo } from 'react';
import { exportPDF } from '@/utils/exportUtils';
import { exportCorporateWorkbook } from '@/utils/export';
import { useExportContext } from '@/utils/export/useExportContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { DollarSign, Download, Users, XCircle, CheckCircle, Clock, Filter, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ApproveModal, RejectModal, MarkPaidModal } from './PayoutActionModals';
import LinkedStudentsModal from './LinkedStudentsModal';

const PayoutsManagement: React.FC<{ onRefresh?: () => void }> = ({ onRefresh }) => {
  const { toast } = useToast();
  const { t, i18n } = useTranslation('dashboard');
  const { author, locale: exportLocale, rtl } = useExportContext();
  const isMobile = useIsMobile();
  const [requests, setRequests] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { full_name: string; email: string }>>({});
  const [filter, setFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Modals
  const [approveTarget, setApproveTarget] = useState<any>(null);
  const [rejectTarget, setRejectTarget] = useState<any>(null);
  const [payTarget, setPayTarget] = useState<any>(null);
  const [studentsModal, setStudentsModal] = useState<string[] | null>(null);

  const locale = i18n.language === 'ar' ? 'ar' : 'en-US';

  const fetchRequests = async () => {
    const { data, error } = await (supabase as any).rpc('list_payout_requests');
    if (error) {
      toast({ variant: 'destructive', title: t('common.actionFailed'), description: error.message });
      return;
    }
    setRequests(data || []);
  };

  useEffect(() => { fetchRequests(); }, []);

  const filtered = useMemo(() => {
    let res = requests;
    if (filter !== 'all') res = res.filter(r => r.status === filter);
    if (roleFilter !== 'all') res = res.filter(r => r.requestor_role === roleFilter);
    return res;
  }, [requests, filter, roleFilter]);

  // KPIs
  const pendingInfluencer = requests.filter(r => r.requestor_role === 'social_media_partner' && (r.status === 'pending' || r.status === 'approved')).reduce((s, r) => s + Number(r.amount), 0);
  const pendingStudent = requests.filter(r => r.requestor_role === 'student' && (r.status === 'pending' || r.status === 'approved')).reduce((s, r) => s + Number(r.amount), 0);
  const totalPaid = requests.filter(r => r.status === 'paid').reduce((s, r) => s + Number(r.amount), 0);
  const totalRejected = requests.filter(r => r.status === 'rejected').reduce((s, r) => s + Number(r.amount), 0);

  const getName = (r: any) => r?.requestor_name || t('admin.payouts.unknownRequester');
  const getEmail = (r: any) => r?.requestor_email || '';

  // Every write goes through admin_respond_payout_request() — no direct client
  // writes to payout_requests. The RPC also audits, syncs rewards and posts the
  // status message back into the requester's chat thread.
  const respond = async (req: any, action: 'approve' | 'reject' | 'pay', note?: string, transactionRef?: string) => {
    const { error } = await (supabase as any).rpc('admin_respond_payout_request', {
      p_request_id: req.id,
      p_action: action,
      p_note: note || null,
      p_transaction_ref: transactionRef || null,
    });
    if (error) {
      toast({ variant: 'destructive', title: t('common.actionFailed'), description: error.message });
      return false;
    }
    return true;
  };

  const handleApprove = async (notes: string) => {
    if (!approveTarget) return;
    const ok = await respond(approveTarget, 'approve', notes);
    setApproveTarget(null);
    if (!ok) return;
    toast({ title: t('admin.payouts.statusUpdated') });
    fetchRequests();
    onRefresh?.();
  };

  const handleReject = async (reason: string) => {
    if (!rejectTarget) return;
    const ok = await respond(rejectTarget, 'reject', reason);
    setRejectTarget(null);
    if (!ok) return;
    toast({ title: t('admin.payouts.statusUpdated') });
    fetchRequests();
    onRefresh?.();
  };

  const handleMarkPaid = async (paymentMethod: string, transactionRef: string, notes: string) => {
    if (!payTarget) return;
    const note = [notes, paymentMethod ? `method: ${paymentMethod}` : ''].filter(Boolean).join(' — ');
    const ok = await respond(payTarget, 'pay', note, transactionRef);
    setPayTarget(null);
    if (!ok) return;
    toast({ title: t('admin.payouts.statusUpdated') });
    fetchRequests();
    onRefresh?.();
  };

  const bulkAction = async (action: 'approve' | 'reject') => {
    const ids = [...selected];
    if (!ids.length) return;
    let failures = 0;
    for (const id of ids) {
      const req = requests.find(r => r.id === id);
      if (!req) continue;
      const ok = await respond(req, action, action === 'reject' ? t('admin.payouts.bulkRejectReason', 'Rejected in bulk review') : undefined);
      if (!ok) failures++;
    }
    setSelected(new Set());
    if (failures === 0) toast({ title: t('admin.payouts.statusUpdated') });
    fetchRequests();
    onRefresh?.();
  };



  const exportExcel = () =>
    exportCorporateWorkbook({
      fileName: `DARB-payouts-${new Date().toISOString().slice(0, 10)}`,
      title: t('admin.payouts.reportTitle', 'Payouts Report'),
      author,
      locale: exportLocale,
      rtl,
      sheets: [{
        name: t('admin.payouts.reportTitle', 'Payouts Report'),
        columns: [
          { header: t('admin.payouts.requestId', 'Request ID'), type: 'text' },
          { header: t('admin.payouts.requester'), type: 'text' },
          { header: t('admin.payouts.role'), type: 'text' },
          { header: t('admin.payouts.linkedStudents'), type: 'text' },
          { header: t('admin.payouts.amount'), type: 'currency', currency: 'ILS', total: 'sum', dataBar: true },
          { header: t('admin.payouts.status'), type: 'status' },
          { header: t('admin.payouts.requestDate'), type: 'date' },
          { header: t('admin.payouts.approvalDate', 'Approval Date'), type: 'date' },
          { header: t('admin.payouts.paymentMethodCol'), type: 'text' },
          { header: t('admin.payouts.notes', 'Notes'), type: 'text' },
        ],
        rows: filtered.map(r => [
          r.id.slice(0, 8),
          getName(r),
          r.requestor_role,
          (r.linked_student_names || []).join('; '),
          Number(r.amount) || 0,
          String(t(`admin.payouts.statuses.${r.status}`, { defaultValue: r.status })),
          r.requested_at,
          r.approved_at || null,
          r.payment_method ? String(t(`admin.payouts.methods.${r.payment_method}`, { defaultValue: r.payment_method })) : '',
          r.admin_notes || '',
        ]),
      }],
    });

  const toggleSelect = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(r => r.id)));
  };

  const statusColor = (s: string) => {
    if (s === 'paid') return 'default';
    if (s === 'rejected') return 'destructive';
    return 'secondary';
  };

  const StatusBadge = ({ status }: { status: string }) => (
    <Badge variant={statusColor(status) as any}>{String(t(`admin.payouts.statuses.${status}`, { defaultValue: status }))}</Badge>
  );

  const RoleBadge = ({ role }: { role: string }) => (
    <Badge variant="outline" className="text-xs">{role === 'social_media_partner' ? t('admin.referralsMgmt.agent') : t('admin.referralsMgmt.student')}</Badge>
  );

  const ActionButtons = ({ req }: { req: any }) => {
    if (req.status === 'paid' || req.status === 'rejected') return null;
    return (
      <div className="flex gap-1.5 flex-wrap">
        {req.status === 'pending' && <Button size="sm" variant="outline" onClick={() => setApproveTarget(req)}><CheckCircle className="h-3.5 w-3.5 me-1" />{t('admin.payouts.approveBtn', 'Approve')}</Button>}
        {req.status === 'pending' && <Button size="sm" variant="destructive" onClick={() => setRejectTarget(req)}><XCircle className="h-3.5 w-3.5 me-1" />{t('admin.payouts.rejectBtn', 'Reject')}</Button>}
        {req.status === 'approved' && <Button size="sm" onClick={() => setPayTarget(req)}><DollarSign className="h-3.5 w-3.5 me-1" />{t('admin.payouts.pay')}</Button>}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500"><Clock className="h-5 w-5 text-white" /></div>
          <div>
            <p className="text-xs text-muted-foreground">{t('admin.payouts.pendingInfluencer', 'Partner Pending')}</p>
            <p className="text-xl font-bold">{pendingInfluencer.toLocaleString('en-US')} ₪</p>
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">{t('admin.payouts.partnerPendingHint', 'Partner payout requests')}</p>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500"><Clock className="h-5 w-5 text-white" /></div>
          <div><p className="text-xs text-muted-foreground">{t('admin.payouts.pendingStudent', 'Student Pending')}</p><p className="text-xl font-bold">{pendingStudent.toLocaleString('en-US')} ₪</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-600"><CheckCircle className="h-5 w-5 text-white" /></div>
          <div><p className="text-xs text-muted-foreground">{t('admin.payouts.totalPaid')}</p><p className="text-xl font-bold">{totalPaid.toLocaleString('en-US')} ₪</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-destructive"><XCircle className="h-5 w-5 text-white" /></div>
          <div><p className="text-xs text-muted-foreground">{t('admin.payouts.totalRejected', 'Rejected')}</p><p className="text-xl font-bold">{totalRejected.toLocaleString('en-US')} ₪</p></div>
        </CardContent></Card>
      </div>

      {/* Filters + Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('admin.payouts.all')} ({requests.length})</SelectItem>
            {['pending', 'approved', 'paid', 'rejected'].map(s => (
              <SelectItem key={s} value={s}>{String(t(`admin.payouts.statuses.${s}`, { defaultValue: s }))} ({requests.filter(r => r.status === s).length})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('admin.payouts.allRoles', 'All Roles')}</SelectItem>
            <SelectItem value="social_media_partner">{t('admin.referralsMgmt.agent')}</SelectItem>
            <SelectItem value="student">{t('admin.referralsMgmt.student')}</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        {selected.size > 0 && (
          <>
            <Button size="sm" variant="outline" onClick={() => bulkAction('approve')}>{t('admin.payouts.bulkApprove', 'Bulk Approve')} ({selected.size})</Button>
            <Button size="sm" variant="destructive" onClick={() => bulkAction('reject')}>{t('admin.payouts.bulkReject', 'Bulk Reject')} ({selected.size})</Button>
          </>
        )}
        <Button size="sm" variant="outline" onClick={exportExcel}><Download className="h-4 w-4 me-1" />{t('admin.payouts.exportExcel', 'Export Excel')}</Button>
        <Button size="sm" variant="outline" onClick={() => {
          const headers = [t('admin.payouts.requester'), t('admin.payouts.role'), t('admin.payouts.linkedStudents'), t('admin.payouts.amount'), t('admin.payouts.status'), t('admin.payouts.requestDate'), t('admin.payouts.paymentMethodCol')];
          const pdfRows = filtered.map(r => [getName(r), r.requestor_role, (r.linked_student_names || []).join('; '), `${Number(r.amount).toLocaleString('en-US')} ₪`, String(t(`admin.payouts.statuses.${r.status}`, { defaultValue: r.status })), new Date(r.requested_at).toLocaleDateString(locale), r.payment_method ? String(t(`admin.payouts.methods.${r.payment_method}`, { defaultValue: r.payment_method })) : '—']);
          exportPDF({ headers, rows: pdfRows, fileName: `payouts-${new Date().toISOString().slice(0, 10)}`, title: 'Darb Study International — Payouts' });
        }}><FileText className="h-4 w-4 me-1" />PDF</Button>
      </div>

      {/* Table / Cards */}
      {isMobile ? (
        <div className="space-y-3">
          {filtered.map(r => (
            <Card key={r.id} className="overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{getName(r)}</p>
                    <p className="text-xs text-muted-foreground">{getEmail(r)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <RoleBadge role={r.requestor_role} />
                    <StatusBadge status={r.status} />
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-lg">{Number(r.amount).toLocaleString('en-US')} ₪</span>
                  <span className="text-xs text-muted-foreground">{new Date(r.requested_at).toLocaleDateString(locale)}</span>
                </div>
                {r.linked_student_names?.length > 0 && (
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => setStudentsModal(r.linked_student_names)}>
                    <Users className="h-3.5 w-3.5 me-1" />{r.linked_student_names.length} {t('admin.payouts.linkedStudents', 'students')}
                  </Button>
                )}
                {r.payment_method && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">{t('admin.payouts.paymentMethodCol', 'Method')}:</span>{' '}
                    {String(t(`admin.payouts.methods.${r.payment_method}`, { defaultValue: r.payment_method }))}
                  </p>
                )}
                <ActionButtons req={r} />
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && <p className="p-8 text-center text-muted-foreground">{t('admin.payouts.noRewards')}</p>}
        </div>
      ) : (
        <Card className="w-full overflow-hidden">
          <div className="w-full overflow-x-auto">
              <table className="w-full table-fixed text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="w-[4%] px-4 py-3 text-start"><Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} /></th>
                    <th className="w-[16%] px-4 py-3 text-start font-semibold">{t('admin.payouts.requester')}</th>
                    <th className="w-[8%] px-4 py-3 text-start font-semibold">{t('admin.payouts.role', 'Role')}</th>
                    <th className="w-[10%] px-4 py-3 text-start font-semibold">{t('admin.payouts.linkedStudents', 'Students')}</th>
                    <th className="w-[10%] px-4 py-3 text-start font-semibold">{t('admin.payouts.amount')}</th>
                    <th className="w-[10%] px-4 py-3 text-start font-semibold">{t('admin.payouts.status')}</th>
                    <th className="w-[14%] px-4 py-3 text-start font-semibold">{t('admin.payouts.requestDate')}</th>
                    <th className="w-[12%] px-4 py-3 text-start font-semibold">{t('admin.payouts.paymentMethodCol', 'Method')}</th>
                    <th className="w-[16%] px-4 py-3 text-start font-semibold">{t('admin.payouts.action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-3"><Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleSelect(r.id)} /></td>
                      <td className="px-3 py-3">
                        <p className="font-medium">{getName(r)}</p>
                        <p className="text-xs text-muted-foreground">{getEmail(r)}</p>
                      </td>
                      <td className="px-3 py-3"><RoleBadge role={r.requestor_role} /></td>
                      <td className="px-3 py-3">
                        {r.linked_student_names?.length > 0 ? (
                          <Button variant="ghost" size="sm" className="text-xs h-auto p-1" onClick={() => setStudentsModal(r.linked_student_names)}>
                            <Users className="h-3.5 w-3.5 me-1" />{r.linked_student_names.length}
                          </Button>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-3 font-medium">{Number(r.amount).toLocaleString('en-US')} ₪</td>
                      <td className="px-3 py-3"><StatusBadge status={r.status} /></td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">{new Date(r.requested_at).toLocaleDateString(locale)}</td>
                      <td className="px-3 py-3 text-xs">{r.payment_method ? String(t(`admin.payouts.methods.${r.payment_method}`, { defaultValue: r.payment_method })) : '—'}</td>
                      <td className="px-3 py-3"><ActionButtons req={r} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && <p className="p-8 text-center text-muted-foreground">{t('admin.payouts.noRewards')}</p>}
          </div>
        </Card>
      )}

      {/* Modals */}
      <ApproveModal open={!!approveTarget} onOpenChange={o => { if (!o) setApproveTarget(null); }} onConfirm={handleApprove} amount={approveTarget?.amount} />
      <RejectModal open={!!rejectTarget} onOpenChange={o => { if (!o) setRejectTarget(null); }} onConfirm={handleReject} />
      <MarkPaidModal open={!!payTarget} onOpenChange={o => { if (!o) setPayTarget(null); }} onConfirm={handleMarkPaid} amount={payTarget?.amount} />
      <LinkedStudentsModal open={!!studentsModal} onOpenChange={o => { if (!o) setStudentsModal(null); }} studentNames={studentsModal || []} />
    </div>
  );
};

export default PayoutsManagement;
