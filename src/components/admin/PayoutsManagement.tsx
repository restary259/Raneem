import React, { useCallback, useEffect, useState } from 'react';
import { exportPDF } from '@/utils/exportUtils';
import { exportCorporateWorkbook } from '@/utils/export';
import { useExportContext } from '@/utils/export/useExportContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Users, Download, FileText, HandCoins, UserCheck, GraduationCap } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from 'react-i18next';
import RoleDirectory from './RoleDirectory';
import type { PayoutRole } from './RequesterProfilePanel';

/**
 * Admin payout surface — five role-segmented directories.
 *
 * Every requester role (team member, agent, partner, ambassador, student) gets
 * its own browsable directory whose profiles carry that requester's balance,
 * history and payout requests. Payout requests created via chat
 * (request_payout_via_chat) persist into payout_requests and are returned by
 * list_payout_requests(); the directories re-partition those rows by
 * requestor_role. All admin writes go through usePayoutActions() →
 * admin_respond_payout_request().
 */
const PayoutsManagement: React.FC<{ onRefresh?: () => void }> = ({ onRefresh }) => {
  const { toast } = useToast();
  const { t } = useTranslation('dashboard');
  const { author, locale: exportLocale, rtl } = useExportContext();

  const [requests, setRequests] = useState<any[]>([]);

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

  const roleOpenCount = (role: string) => requests.filter(
    r => r.requestor_role === role && (r.status === 'pending' || r.status === 'approved'),
  ).length;

  const getName = (r: any) => r?.requestor_name || t('admin.payouts.unknownRequester');

  const roleLabel = (role: string) =>
    role === 'team_member'
      ? t('admin.payouts.roleTeamMember')
      : role === 'agent'
        ? t('admin.payouts.roleAgent')
        : role === 'ambassador'
          ? t('admin.payouts.roleAmbassador')
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

  const tabs: { value: string; role: PayoutRole; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { value: 'team', role: 'team_member', label: t('admin.payouts.tabTeam', 'Team'), icon: Users },
    { value: 'agents', role: 'agent', label: t('admin.payouts.tabAgents', 'Agents'), icon: UserCheck },
    { value: 'partners', role: 'social_media_partner', label: t('admin.payouts.tabPartners', 'Partners'), icon: HandCoins },
    { value: 'ambassadors', role: 'ambassador', label: t('admin.payouts.tabAmbassadors', 'Ambassadors'), icon: Users },
    { value: 'students', role: 'student', label: t('admin.payouts.tabStudents', 'Students'), icon: GraduationCap },
  ];

  return (
    <Tabs defaultValue="partners" className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <TabsList className="flex-wrap">
          {tabs.map(tab => {
            const openCount = roleOpenCount(tab.role);
            const Icon = tab.icon;
            return (
              <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
                <Icon className="h-4 w-4" />
                {tab.label}
                {openCount > 0 && <Badge variant="secondary" className="ms-1">{openCount}</Badge>}
              </TabsTrigger>
            );
          })}
        </TabsList>
        <div className="flex-1" />
        <Button size="sm" variant="outline" className="gap-2" onClick={exportExcel}>
          <Download className="h-4 w-4" />{t('admin.payouts.exportExcel', 'Export Excel')}
        </Button>
        <Button size="sm" variant="outline" className="gap-2" onClick={exportPdf}>
          <FileText className="h-4 w-4" />PDF
        </Button>
      </div>

      {tabs.map(tab => (
        <TabsContent key={tab.value} value={tab.value}>
          <RoleDirectory role={tab.role} requests={requests} onRefresh={refreshAll} />
        </TabsContent>
      ))}
    </Tabs>
  );
};

export default PayoutsManagement;
