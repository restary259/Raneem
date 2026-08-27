import React, { useCallback, useEffect, useState } from 'react';
import { exportCorporateWorkbook, exportCorporatePdf, type CorporateReport } from '@/utils/export';
import { useExportContext } from '@/utils/export/useExportContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Users, Download, FileText, HandCoins, UserCheck, GraduationCap } from 'lucide-react';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import SegmentedTabs, { type SegmentItem } from '@/components/shell/SegmentedTabs';
import { useTranslation } from 'react-i18next';
import RoleDirectory from './RoleDirectory';
import type { PayoutRole } from './RequesterProfilePanel';
import { getRoleLabel } from '@/lib/roleLabels';

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

  // Exports intentionally cover ALL payout requests (every role), not just the
  // active tab — this is a complete payouts report by design (see AGENTS.md).
  /** One report definition backs both the Excel and the PDF download. */
  const buildReport = (): CorporateReport => ({
    fileName: `DARB-payouts-${new Date().toISOString().slice(0, 10)}`,
    title: t('admin.payouts.reportTitle', 'Payouts Report'),
    author,
    locale: exportLocale,
    rtl,
    totalLabel: t('sheets.total'),
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
        getRoleLabel(r.requestor_role),
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

  const exportExcel = async () => {
    try {
      await exportCorporateWorkbook(buildReport());
    } catch {
      toast({ variant: 'destructive', description: t('sheets.exportFailed') });
    }
  };

  const exportPdf = async () => {
    try {
      const { empty, rtlFontMissing } = await exportCorporatePdf(buildReport());
      if (empty) toast({ description: t('admin.payouts.empty', 'No requests yet.') });
      else if (rtlFontMissing) toast({ variant: 'destructive', description: t('sheets.pdfFontWarning') });
    } catch {
      toast({ variant: 'destructive', description: t('sheets.exportFailed') });
    }
  };

  const tabs: { value: string; role: PayoutRole; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { value: 'team', role: 'team_member', label: t('admin.payouts.tabTeam', 'Team'), icon: Users },
    { value: 'agents', role: 'agent', label: t('admin.payouts.tabAgents', 'Agents'), icon: UserCheck },
    { value: 'partners', role: 'social_media_partner', label: t('admin.payouts.tabPartners', 'Partners'), icon: HandCoins },
    { value: 'ambassadors', role: 'ambassador', label: t('admin.payouts.tabAmbassadors', 'Ambassadors'), icon: Users },
    { value: 'students', role: 'student', label: t('admin.payouts.tabStudents', 'Students'), icon: GraduationCap },
  ];

  const items: SegmentItem[] = tabs.map(tab => {
    const openCount = roleOpenCount(tab.role);
    return {
      value: tab.value,
      icon: tab.icon,
      label: (
        <span className="flex items-center gap-1.5">
          {tab.label}
          {openCount > 0 && <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{openCount}</Badge>}
        </span>
      ),
    };
  });

  return (
    <Tabs defaultValue="partners" className="space-y-4">
      <div className="space-y-2">
        <SegmentedTabs items={items} />
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" className="gap-2" onClick={exportExcel}>
            <Download className="h-4 w-4" />{t('sheets.exportExcel')}
          </Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={exportPdf}>
            <FileText className="h-4 w-4" />{t('sheets.exportPdf')}
          </Button>
        </div>
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
