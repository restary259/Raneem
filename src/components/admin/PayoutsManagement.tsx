import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { exportPDF } from '@/utils/exportUtils';
import { exportCorporateWorkbook } from '@/utils/export';
import { useExportContext } from '@/utils/export/useExportContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { DollarSign, Download, Users, XCircle, CheckCircle, Clock, FileText, HandCoins, FileDown, Info } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTranslation } from 'react-i18next';
import { ApproveModal, RejectModal, MarkPaidModal } from './PayoutActionModals';
import LinkedStudentsModal from './LinkedStudentsModal';
import PartnersDirectory from './PartnersDirectory';
import { usePayoutActions } from '@/hooks/usePayoutActions';

/**
 * Admin payout surface — partner-first.
 *
 * "Partners" is the primary architecture: a browsable partner directory whose
 * profiles carry that partner's balance, history and payout requests.
 * "Other requests" keeps ambassadors and students payable without putting them
 * in the partner directory.
 */
const PayoutsManagement: React.FC<{ onRefresh?: () => void }> = ({ onRefresh }) => {
  const { toast } = useToast();
  const { t } = useTranslation('dashboard');
  const { author, locale: exportLocale, rtl } = useExportContext();
  const isMobile = useIsMobile();
  const { respond } = usePayoutActions();

  const [requests, setRequests] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');

  const [approveTarget, setApproveTarget] = useState<any>(null);
  const [rejectTarget, setRejectTarget] = useState<any>(null);
  const [payTarget, setPayTarget] = useState<any>(null);
  const [studentsModal, setStudentsModal] = useState<string[] | null>(null);

  const fetchRequests = useCallback(async () => {
    const { data, error } = await (supabase as any).rpc('list_payout_requests');
    if (error) {
      toast({ variant: 'destructive', title: t('common.actionFailed'), description: error.message });
      return;
    }
    setRequests(data || []);
  }, [toast, t]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const refreshAll = useCallback(() => { fetchRequests(); onRefresh?.(); }, [fetchRequests, onRefresh]);

  /** Ambassadors + students only — partners live in the directory. */
  const otherRequests = useMemo(
    () => requests.filter(r => r.requestor_role !== 'social_media_partner'),
    [requests],
  );

  const filtered = useMemo(() => {
    let res = otherRequests;
    if (filter !== 'all') res = res.filter(r => r.status === filter);
    if (roleFilter !== 'all') res = res.filter(r => r.requestor_role === roleFilter);
    return res;
  }, [otherRequests, filter, roleFilter]);

  const partnerOpenCount = requests.filter(
    r => r.requestor_role === 'social_media_partner' && (r.status === 'pending' || r.status === 'approved'),
  ).length;
  const otherOpenCount = otherRequests.filter(r => r.status === 'pending' || r.status === 'approved').length;
  const otherPending = otherRequests
    .filter(r => r.status === 'pending' || r.status === 'approved')
    .reduce((s, r) => s + Number(r.amount), 0);
  const otherPaid = otherRequests.filter(r => r.status === 'paid').reduce((s, r) => s + Number(r.amount), 0);
  const otherRejected = otherRequests.filter(r => r.status === 'rejected').reduce((s, r) => s + Number(r.amount), 0);

  const getName = (r: any) => r?.requestor_name || t('admin.payouts.unknownRequester');
  const getEmail = (r: any) => r?.requestor_email || '';

  const roleLabel = (role: string) =>
    role === 'ambassador'
      ? t('admin.payouts.roleAmbassador', 'Ambassador')
      : role === 'social_media_partner'
        ? t('admin.referralsMgmt.agent')
        : t('admin.referralsMgmt.student');

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
        rows: requests.map(r => [
          r.id.slice(0, 8),
          getName(r),
          roleLabel(r.requestor_role),
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

  const exportPdf = async () => {
    const headers = [
      t('admin.payouts.requestId', 'Request ID'), t('admin.payouts.requester'), t('admin.payouts.role'),
      t('admin.payouts.linkedStudents'), t('admin.payouts.amount'), t('admin.payouts.status'),
      t('admin.payouts.requestDate'), t('admin.payouts.approvalDate', 'Approval Date'),
      t('admin.payouts.paymentMethodCol'), t('admin.payouts.notes', 'Notes'),
    ];
    const dash = '—';
    const pdfRows = requests.map(r => [
      r.id.slice(0, 8),
      getName(r) || dash,
      roleLabel(r.requestor_role),
      (r.linked_student_names || []).join('; ') || dash,
      `${(Number(r.amount) || 0).toLocaleString('en-US')} ₪`,
      String(t(`admin.payouts.statuses.${r.status}`, { defaultValue: r.status })),
      r.requested_at ? new Date(r.requested_at).toLocaleDateString(exportLocale === 'ar' ? 'en-US' : exportLocale) : dash,
      r.approved_at ? new Date(r.approved_at).toLocaleDateString(exportLocale === 'ar' ? 'en-US' : exportLocale) : dash,
      r.payment_method ? String(t(`admin.payouts.methods.${r.payment_method}`, { defaultValue: r.payment_method })) : dash,
      r.admin_notes || dash,
    ]);
    const { rtlFontMissing } = await exportPDF({
      headers,
      rows: pdfRows,
      fileName: `payouts-${new Date().toISOString().slice(0, 10)}`,
      title: t('admin.payouts.pdfTitle', 'Darb Study International — Payouts'),
      locale: exportLocale,
      rtl,
    });
    if (rtlFontMissing) {
      toast({
        variant: 'destructive',
        description: t(
          'admin.payouts.pdfFontWarning',
          'Arabic/Hebrew names could not be embedded in this PDF. Use the Excel export instead.',
        ),
      });
    }
  };


  const StatusBadge = ({ status }: { status: string }) => (
    <Badge variant={status === 'paid' ? 'default' : status === 'rejected' ? 'destructive' : 'secondary'}>
      {String(t(`admin.payouts.statuses.${status}`, { defaultValue: status }))}
    </Badge>
  );

  const ActionButtons = ({ req }: { req: any }) => {
    if (req.status === 'paid' || req.status === 'rejected') return null;
    return (
      <div className="flex gap-1.5 flex-wrap">
        {req.status === 'pending' && (
          <>
            <Button size="sm" variant="outline" className="gap-2" onClick={() => setApproveTarget(req)}>
              <CheckCircle className="h-3.5 w-3.5" />{t('admin.payouts.approveBtn', 'Approve')}
            </Button>
            <Button size="sm" variant="destructive" className="gap-2" onClick={() => setRejectTarget(req)}>
              <XCircle className="h-3.5 w-3.5" />{t('admin.payouts.rejectBtn', 'Reject')}
            </Button>
          </>
        )}
        {req.status === 'approved' && (
          <Button size="sm" className="gap-2" onClick={() => setPayTarget(req)}>
            <DollarSign className="h-3.5 w-3.5" />{t('admin.payouts.markTransferred', 'Mark transferred')}
          </Button>
        )}
      </div>
    );
  };

  return (
    <Tabs defaultValue="partners" className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <TabsList>
          <TabsTrigger value="partners" className="gap-2">
            <HandCoins className="h-4 w-4" />
            {t('admin.payouts.tabPartners', 'Partners')}
            {partnerOpenCount > 0 && <Badge variant="secondary" className="ms-1">{partnerOpenCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="other" className="gap-2">
            <Users className="h-4 w-4" />
            {t('admin.payouts.tabOther', 'Other requests')}
            {otherOpenCount > 0 && <Badge variant="secondary" className="ms-1">{otherOpenCount}</Badge>}
          </TabsTrigger>
        </TabsList>
        <div className="flex-1" />
        <Button size="sm" variant="outline" className="gap-2" onClick={exportExcel}>
          <Download className="h-4 w-4" />{t('admin.payouts.exportExcel', 'Export Excel')}
        </Button>
        <Button size="sm" variant="outline" className="gap-2" onClick={exportPdf}>
          <FileText className="h-4 w-4" />PDF
        </Button>
      </div>

      <TabsContent value="partners">
        <PartnersDirectory requests={requests} onRefresh={refreshAll} />
      </TabsContent>

      <TabsContent value="other" className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            {t('admin.payouts.otherRequestsHint', 'Ambassador and student payout requests are reviewed here — they are not part of the partner directory.')}
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500"><Clock className="h-5 w-5 text-white" /></div>
            <div><p className="text-xs text-muted-foreground">{t('admin.payouts.pendingStudent', 'Pending')}</p><p className="text-xl font-bold">{otherPending.toLocaleString('en-US')} ₪</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-600"><CheckCircle className="h-5 w-5 text-white" /></div>
            <div><p className="text-xs text-muted-foreground">{t('admin.payouts.totalPaid')}</p><p className="text-xl font-bold">{otherPaid.toLocaleString('en-US')} ₪</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-destructive"><XCircle className="h-5 w-5 text-white" /></div>
            <div><p className="text-xs text-muted-foreground">{t('admin.payouts.totalRejected', 'Rejected')}</p><p className="text-xl font-bold">{otherRejected.toLocaleString('en-US')} ₪</p></div>
          </CardContent></Card>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('admin.payouts.all')} ({otherRequests.length})</SelectItem>
              {['pending', 'approved', 'paid', 'rejected'].map(s => (
                <SelectItem key={s} value={s}>
                  {String(t(`admin.payouts.statuses.${s}`, { defaultValue: s }))} ({otherRequests.filter(r => r.status === s).length})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('admin.payouts.allRoles', 'All Roles')}</SelectItem>
              <SelectItem value="ambassador">{t('admin.payouts.roleAmbassador', 'Ambassador')}</SelectItem>
              <SelectItem value="student">{t('admin.referralsMgmt.student')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isMobile ? (
          <div className="space-y-3">
            {filtered.map(r => (
              <Card key={r.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{getName(r)}</p>
                      <p className="text-xs text-muted-foreground">{getEmail(r)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{roleLabel(r.requestor_role)}</Badge>
                      <StatusBadge status={r.status} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold text-lg">{Number(r.amount).toLocaleString('en-US')} ₪</span>
                    <span className="text-xs text-muted-foreground">{new Date(r.requested_at).toLocaleDateString(exportLocale === 'ar' ? 'en-US' : exportLocale)}</span>
                  </div>
                  {r.linked_student_names?.length > 0 && (
                    <Button variant="ghost" size="sm" className="text-xs gap-2" onClick={() => setStudentsModal(r.linked_student_names)}>
                      <Users className="h-3.5 w-3.5" />{r.linked_student_names.length} {t('admin.payouts.linkedStudents', 'Students')}
                    </Button>
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
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-start font-semibold">{t('admin.payouts.requester')}</th>
                    <th className="px-4 py-3 text-start font-semibold">{t('admin.payouts.role', 'Role')}</th>
                    <th className="px-4 py-3 text-start font-semibold">{t('admin.payouts.linkedStudents', 'Students')}</th>
                    <th className="px-4 py-3 text-start font-semibold">{t('admin.payouts.amount')}</th>
                    <th className="px-4 py-3 text-start font-semibold">{t('admin.payouts.status')}</th>
                    <th className="px-4 py-3 text-start font-semibold">{t('admin.payouts.requestDate')}</th>
                    <th className="px-4 py-3 text-start font-semibold">{t('admin.payouts.action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium">{getName(r)}</p>
                        <p className="text-xs text-muted-foreground">{getEmail(r)}</p>
                      </td>
                      <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{roleLabel(r.requestor_role)}</Badge></td>
                      <td className="px-4 py-3">
                        {r.linked_student_names?.length > 0 ? (
                          <Button variant="ghost" size="sm" className="text-xs h-auto p-1 gap-1" onClick={() => setStudentsModal(r.linked_student_names)}>
                            <Users className="h-3.5 w-3.5" />{r.linked_student_names.length}
                          </Button>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 font-medium">{Number(r.amount).toLocaleString('en-US')} ₪</td>
                      <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(r.requested_at).toLocaleDateString(exportLocale === 'ar' ? 'en-US' : exportLocale)}</td>
                      <td className="px-4 py-3"><ActionButtons req={r} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && <p className="p-8 text-center text-muted-foreground">{t('admin.payouts.noRewards')}</p>}
            </div>
          </Card>
        )}
      </TabsContent>

      <ApproveModal
        open={!!approveTarget}
        onOpenChange={o => { if (!o) setApproveTarget(null); }}
        amount={approveTarget?.amount}
        onConfirm={async (notes: string) => {
          const target = approveTarget;
          setApproveTarget(null);
          if (target && await respond(target.id, 'approve', notes)) refreshAll();
        }}
      />
      <RejectModal
        open={!!rejectTarget}
        onOpenChange={o => { if (!o) setRejectTarget(null); }}
        onConfirm={async (reason: string) => {
          const target = rejectTarget;
          setRejectTarget(null);
          if (target && await respond(target.id, 'reject', reason)) refreshAll();
        }}
      />
      <MarkPaidModal
        open={!!payTarget}
        onOpenChange={o => { if (!o) setPayTarget(null); }}
        amount={payTarget?.amount}
        onConfirm={async (paymentMethod: string, transactionRef: string, notes: string) => {
          const target = payTarget;
          setPayTarget(null);
          if (!target) return;
          const note = [notes, paymentMethod ? `method: ${paymentMethod}` : ''].filter(Boolean).join(' — ');
          if (await respond(target.id, 'pay', note, transactionRef)) refreshAll();
        }}
      />
      <LinkedStudentsModal
        open={!!studentsModal}
        onOpenChange={o => { if (!o) setStudentsModal(null); }}
        studentNames={studentsModal || []}
      />
    </Tabs>
  );
};

export default PayoutsManagement;
