import React, { useEffect, useState, useMemo } from 'react';
import { exportPDF } from '@/utils/exportUtils';
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
    const { data } = await (supabase as any).from('payout_requests').select('*').order('requested_at', { ascending: false });
    if (data) {
      setRequests(data);
      const userIds = [...new Set(data.map((r: any) => r.requestor_id))];
      if (userIds.length > 0) {
        const { data: profs } = await (supabase as any).from('profiles').select('id, full_name, email').in('id', userIds);
        if (profs) {
          const map: Record<string, any> = {};
          profs.forEach((p: any) => { map[p.id] = { full_name: p.full_name, email: p.email }; });
          setProfiles(map);
        }
      }
    }
  };

  useEffect(() => { fetchRequests(); }, []);

  const filtered = useMemo(() => {
    let res = requests;
    if (filter !== 'all') res = res.filter(r => r.status === filter);
    if (roleFilter !== 'all') res = res.filter(r => r.requestor_role === roleFilter);
    return res;
  }, [requests, filter, roleFilter]);

  // KPIs
  const pendingInfluencer = requests.filter(r => r.requestor_role === 'influencer' && (r.status === 'pending' || r.status === 'approved')).reduce((s, r) => s + Number(r.amount), 0);
  const pendingStudent = requests.filter(r => r.requestor_role === 'student' && (r.status === 'pending' || r.status === 'approved')).reduce((s, r) => s + Number(r.amount), 0);
  const totalPaid = requests.filter(r => r.status === 'paid').reduce((s, r) => s + Number(r.amount), 0);
  const totalRejected = requests.filter(r => r.status === 'rejected').reduce((s, r) => s + Number(r.amount), 0);

  const getName = (id: string) => profiles[id]?.full_name || t('admin.payouts.unknownRequester');
  const getEmail = (id: string) => profiles[id]?.email || '';

  const handleApprove = async (notes: string) => {
    if (!approveTarget) return;
    const { data: { session } } = await supabase.auth.getSession();
    await (supabase as any).from('payout_requests').update({
      status: 'approved', admin_notes: notes || null,
      approved_at: new Date().toISOString(),
      approved_by: session?.user?.id || null,
    }).eq('id', approveTarget.id);
    toast({ title: t('admin.payouts.statusUpdated') });
    setApproveTarget(null);
    fetchRequests();
    onRefresh?.();
  };

  const handleReject = async (reason: string) => {
    if (!rejectTarget) return;
    await (supabase as any).from('payout_requests').update({ status: 'rejected', reject_reason: reason }).eq('id', rejectTarget.id);
    toast({ title: t('admin.payouts.statusUpdated') });
    setRejectTarget(null);
    fetchRequests();
    onRefresh?.();
  };

  const handleMarkPaid = async (paymentMethod: string, transactionRef: string, notes: string) => {
    if (!payTarget) return;
    const { data: { session } } = await supabase.auth.getSession();
    const adminId = session?.user?.id || null;
    // Update request
    await (supabase as any).from('payout_requests').update({
      status: 'paid', payment_method: paymentMethod, transaction_ref: transactionRef,
      admin_notes: notes || payTarget.admin_notes, paid_at: new Date().toISOString(),
      paid_by: adminId,
    }).eq('id', payTarget.id);
    // Update linked rewards
    if (payTarget.linked_reward_ids?.length) {
      for (const rid of payTarget.linked_reward_ids) {
        await (supabase as any).from('rewards').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', rid);
      }
    }
    // Insert transaction log
    await (supabase as any).from('transaction_log').insert({
      type: payTarget.requestor_role === 'influencer' ? 'influencer_payout' : 'student_cashback',
      payout_request_id: payTarget.id,
      amount: payTarget.amount,
      payment_method: paymentMethod,
      transaction_ref: transactionRef,
      notes,
      approved_by: adminId,
    });
    toast({ title: t('admin.payouts.statusUpdated') });
    setPayTarget(null);
    fetchRequests();
    onRefresh?.();
  };

  const bulkAction = async (action: 'approved' | 'rejected') => {
    const ids = [...selected];
    if (!ids.length) return;
    const { data: { session } } = await supabase.auth.getSession();
    const adminId = session?.user?.id || null;
    for (const id of ids) {
      await (supabase as any).from('payout_requests').update({
        status: action,
        ...(action === 'approved' ? { approved_at: new Date().toISOString(), approved_by: adminId } : {}),
      }).eq('id', id);
    }
    setSelected(new Set());
    toast({ title: t('admin.payouts.statusUpdated') });
    fetchRequests();
    onRefresh?.();
  };

  const exportCSV = () => {
    const headers = ['Request ID', 'Requestor', 'Role', 'Linked Students', 'Amount', 'Status', 'Request Date', 'Approval Date', 'Payment Method', 'Notes'];
    const rows = filtered.map(r => [
      r.id.slice(0, 8), getName(r.requestor_id), r.requestor_role,
      (r.linked_student_names || []).join('; '), r.amount, r.status,
      new Date(r.requested_at).toLocaleDateString(locale),
      r.approved_at ? new Date(r.approved_at).toLocaleDateString(locale) : '',
      r.payment_method || '', r.admin_notes || ''
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `payouts-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

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
    <Badge variant="outline" className="text-xs">{role === 'influencer' ? t('admin.referralsMgmt.agent') : t('admin.referralsMgmt.student')}</Badge>
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
          <div><p className="text-xs text-muted-foreground">{t('admin.payouts.pendingInfluencer', 'Agent Pending')}</p><p className="text-xl font-bold">{pendingInfluencer.toLocaleString()} ₪</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500"><Clock className="h-5 w-5 text-white" /></div>
          <div><p className="text-xs text-muted-foreground">{t('admin.payouts.pendingStudent', 'Student Pending')}</p><p className="text-xl font-bold">{pendingStudent.toLocaleString()} ₪</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-600"><CheckCircle className="h-5 w-5 text-white" /></div>
          <div><p className="text-xs text-muted-foreground">{t('admin.payouts.totalPaid')}</p><p className="text-xl font-bold">{totalPaid.toLocaleString()} ₪</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-destructive"><XCircle className="h-5 w-5 text-white" /></div>
          <div><p className="text-xs text-muted-foreground">{t('admin.payouts.totalRejected', 'Rejected')}</p><p className="text-xl font-bold">{totalRejected.toLocaleString()} ₪</p></div>
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
            <SelectItem value="influencer">{t('admin.referralsMgmt.agent')}</SelectItem>
            <SelectItem value="student">{t('admin.referralsMgmt.student')}</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        {selected.size > 0 && (
          <>
            <Button size="sm" variant="outline" onClick={() => bulkAction('approved')}>{t('admin.payouts.bulkApprove', 'Bulk Approve')} ({selected.size})</Button>
            <Button size="sm" variant="destructive" onClick={() => bulkAction('rejected')}>{t('admin.payouts.bulkReject', 'Bulk Reject')} ({selected.size})</Button>
          </>
        )}
        <Button size="sm" variant="outline" onClick={exportCSV}><Download className="h-4 w-4 me-1" />{t('admin.payouts.exportCSV', 'Export CSV')}</Button>
        <Button size="sm" variant="outline" onClick={() => {
          const headers = [t('admin.payouts.requester'), t('admin.payouts.role'), t('admin.payouts.linkedStudents'), t('admin.payouts.amount'), t('admin.payouts.status'), t('admin.payouts.requestDate'), t('admin.payouts.paymentMethodCol')];
          const pdfRows = filtered.map(r => [getName(r.requestor_id), r.requestor_role, (r.linked_student_names || []).join('; '), `${Number(r.amount).toLocaleString()} ₪`, String(t(`admin.payouts.statuses.${r.status}`, { defaultValue: r.status })), new Date(r.requested_at).toLocaleDateString(locale), r.payment_method ? String(t(`admin.payouts.methods.${r.payment_method}`, { defaultValue: r.payment_method })) : '—']);
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
                    <p className="font-semibold">{getName(r.requestor_id)}</p>
                    <p className="text-xs text-muted-foreground">{getEmail(r.requestor_id)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <RoleBadge role={r.requestor_role} />
                    <StatusBadge status={r.status} />
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold text-lg">{Number(r.amount).toLocaleString()} ₪</span>
                  <span className="text-xs text-muted-foreground">{new Date(r.requested_at).toLocaleDateString(locale)}</span>
                </div>
                {r.linked_student_names?.length > 0 && (
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => setStudentsModal(r.linked_student_names)}>
                    <Users className="h-3.5 w-3.5 me-1" />{r.linked_student_names.length} {t('admin.payouts.linkedStudents', 'students')}
                  </Button>
                )}
                <ActionButtons req={r} />
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && <p className="p-8 text-center text-muted-foreground">{t('admin.payouts.noRewards')}</p>}
        </div>
      ) : (
        <div className="bg-background rounded-xl border shadow-sm w-full overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-3 text-start"><Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} /></th>
                    <th className="px-3 py-3 text-start font-semibold">{t('admin.payouts.requester')}</th>
                    <th className="px-3 py-3 text-start font-semibold">{t('admin.payouts.role', 'Role')}</th>
                    <th className="px-3 py-3 text-start font-semibold">{t('admin.payouts.linkedStudents', 'Students')}</th>
                    <th className="px-3 py-3 text-start font-semibold">{t('admin.payouts.amount')}</th>
                    <th className="px-3 py-3 text-start font-semibold">{t('admin.payouts.status')}</th>
                    <th className="px-3 py-3 text-start font-semibold">{t('admin.payouts.requestDate')}</th>
                    <th className="px-3 py-3 text-start font-semibold">{t('admin.payouts.paymentMethodCol', 'Method')}</th>
                    <th className="px-3 py-3 text-start font-semibold">{t('admin.payouts.action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-3"><Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleSelect(r.id)} /></td>
                      <td className="px-3 py-3">
                        <p className="font-medium">{getName(r.requestor_id)}</p>
                        <p className="text-xs text-muted-foreground">{getEmail(r.requestor_id)}</p>
                      </td>
                      <td className="px-3 py-3"><RoleBadge role={r.requestor_role} /></td>
                      <td className="px-3 py-3">
                        {r.linked_student_names?.length > 0 ? (
                          <Button variant="ghost" size="sm" className="text-xs h-auto p-1" onClick={() => setStudentsModal(r.linked_student_names)}>
                            <Users className="h-3.5 w-3.5 me-1" />{r.linked_student_names.length}
                          </Button>
                        ) : '—'}
                      </td>
                      <td className="px-3 py-3 font-medium">{Number(r.amount).toLocaleString()} ₪</td>
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
