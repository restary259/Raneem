import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import SheetTable, { SheetColumn, formatCell } from './SheetTable';
import { useSheetLabels } from './sheetLabels';
import { exportCorporateWorkbook } from '@/utils/export';
import { useExportContext } from '@/utils/export/useExportContext';
import { toExportColumns, toExportRows } from './exportMapping';
import {
  fetchStudentsSheet,
  fetchPaymentsSheet,
  fetchPayoutsSheet,
  fetchCommissionsSheet,
  fetchCatalogSheet,
  fetchTaxSheet,
  fetchPerformanceSheet,
} from './sheetQueries';

interface SheetDef {
  key: string;
  label: string;
  columns: SheetColumn[];
  load: () => Promise<any[]>;
}

interface Props {
  scope: 'admin' | 'team';
  userId?: string;
}

const SpreadsheetHub: React.FC<Props> = ({ scope, userId }) => {
  const { t } = useTranslation('dashboard');
  const { toast } = useToast();
  const { translate } = useSheetLabels();
  const { author, locale, rtl } = useExportContext();
  const [data, setData] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [exporting, setExporting] = useState(false);

  const sheets: SheetDef[] = useMemo(() => {
    const c = (key: string) => t(`sheets.col.${key}`);
    const opts = { scope, userId } as const;

    const students: SheetDef = {
      key: 'students',
      label: t('sheets.tab.students'),
      load: () => fetchStudentsSheet(opts),
      columns: [
        { key: 'case_reference', label: c('reference') },
        { key: 'full_name', label: c('name') },
        { key: 'phone', label: c('phone') },
        { key: 'city', label: c('city') },
        { key: 'status', label: c('status'), type: 'enum', enumGroup: 'status' },
        { key: 'team_member', label: c('teamMember'), hidden: scope === 'team' },
        { key: 'partner', label: c('partner'), hidden: scope === 'team' },
        { key: 'school_name', label: c('school') },
        { key: 'program_name', label: c('program') },
        { key: 'accommodation_name', label: c('accommodation') },
        { key: 'insurance_name', label: c('insurance') },
        { key: 'intake_month', label: c('intakeMonth') },
        { key: 'course_start', label: c('courseStart'), type: 'date' },
        { key: 'course_end', label: c('courseEnd'), type: 'date' },
        { key: 'program_price', label: c('programCost'), type: 'currency', currency: 'EUR', total: true },
        { key: 'accommodation_price', label: c('accommodationCost'), type: 'currency', currency: 'EUR', total: true },
        { key: 'insurance_price', label: c('insuranceCost'), type: 'currency', currency: 'EUR', total: true },
        { key: 'total', label: c('totalCost'), type: 'currency', currency: 'EUR', total: true },
      ],
    };

    const payments: SheetDef = {
      key: 'payments',
      label: t('sheets.tab.payments'),
      load: () => fetchPaymentsSheet(opts),
      columns: [
        { key: 'case_reference', label: c('reference') },
        { key: 'paid_date', label: c('paidDate'), type: 'date' },
        { key: 'student', label: c('student') },
        { key: 'service_fee', label: c('serviceFee'), type: 'currency', total: true },
        { key: 'program_price', label: c('programCost'), type: 'currency', currency: 'EUR' },
        { key: 'accommodation_price', label: c('accommodationCost'), type: 'currency', currency: 'EUR' },
        { key: 'insurance_price', label: c('insuranceCost'), type: 'currency', currency: 'EUR' },
        { key: 'total_paid', label: c('totalPaid'), type: 'currency', total: true },
        { key: 'remaining_balance', label: c('remaining'), type: 'currency', total: true },
        { key: 'confirmed_by', label: c('confirmedBy') },
        { key: 'status', label: c('status'), type: 'enum', enumGroup: 'status' },
      ],
    };

    const commissions: SheetDef = {
      key: 'commissions',
      label: scope === 'team' ? t('sheets.tab.myCommissions') : t('sheets.tab.commissions'),
      load: () => fetchCommissionsSheet(opts),
      columns: [
        { key: 'created_at', label: c('created'), type: 'date' },
        { key: 'person', label: c('person'), hidden: scope === 'team' },
        { key: 'kind', label: c('kind'), type: 'enum', enumGroup: 'kind', hidden: scope === 'team' },
        { key: 'source', label: c('source'), type: 'enum', enumGroup: 'kind' },
        { key: 'amount', label: c('amount'), type: 'currency', total: true },
        { key: 'status', label: c('status'), type: 'enum', enumGroup: 'rewardStatus' },
        { key: 'unlock_date', label: c('unlockDate'), type: 'date' },
        { key: 'paid_at', label: c('paidAt'), type: 'date' },
      ],
    };

    const performance: SheetDef = {
      key: 'performance',
      label: scope === 'team' ? t('sheets.tab.myPerformance') : t('sheets.tab.performance'),
      load: () => fetchPerformanceSheet(opts),
      columns: [
        { key: 'person', label: c('person') },
        { key: 'assigned', label: c('assigned'), type: 'number', total: true },
        { key: 'contacted', label: c('contacted'), type: 'number', total: true },
        { key: 'enrolled', label: c('enrolled'), type: 'number', total: true },
        { key: 'conversion', label: c('conversion'), type: 'percent' },
        { key: 'earned', label: c('earned'), type: 'currency', total: true },
        { key: 'paid', label: c('paidOut'), type: 'currency', total: true },
      ],
    };

    if (scope === 'team') {
      return [
        { ...students, label: t('sheets.tab.myStudents') },
        commissions,
        performance,
      ];
    }

    const payouts: SheetDef = {
      key: 'payouts',
      label: t('sheets.tab.payouts'),
      load: () => fetchPayoutsSheet(),
      columns: [
        { key: 'payout_reference', label: c('reference') },
        { key: 'requested_at', label: c('requested'), type: 'date' },
        { key: 'paid_at', label: c('paidAt'), type: 'date' },
        { key: 'person', label: c('person') },
        { key: 'role', label: c('role'), type: 'enum', enumGroup: 'role' },
        { key: 'students', label: c('linkedStudents') },
        { key: 'amount', label: c('amount'), type: 'currency', total: true },
        { key: 'status', label: c('status'), type: 'enum', enumGroup: 'rewardStatus' },
        { key: 'payment_method', label: c('method'), type: 'enum', enumGroup: 'method' },
        { key: 'transaction_ref', label: c('reference') },
      ],
    };

    const catalog: SheetDef = {
      key: 'catalog',
      label: t('sheets.tab.catalog'),
      load: () => fetchCatalogSheet(),
      columns: [
        { key: 'name', label: c('name') },
        { key: 'kind', label: c('kind'), type: 'enum', enumGroup: 'kind' },
        { key: 'school', label: c('school') },
        { key: 'city', label: c('city') },
        { key: 'type', label: c('type'), type: 'enum', enumGroup: 'programType' },
        { key: 'duration', label: c('duration') },
        { key: 'price', label: c('price'), type: 'number' },
        { key: 'currency', label: c('currency') },
        { key: 'active', label: c('active'), type: 'enum', enumGroup: 'bool' },
        { key: 'students', label: c('studentsPlaced'), type: 'number', total: true },
      ],
    };

    const taxes: SheetDef = {
      key: 'taxes',
      label: t('sheets.tab.taxes'),
      load: () => fetchTaxSheet(),
      columns: [
        { key: 'month', label: c('month'), type: 'enum', enumGroup: 'month' },
        { key: 'gross_collected', label: c('gross'), type: 'currency', total: true },
        { key: 'vat_amount', label: c('vat'), type: 'currency', total: true },
        { key: 'net_before_vat', label: c('netBeforeVat'), type: 'currency', total: true },
        { key: 'commissions_paid', label: c('commissionsPaid'), type: 'currency', total: true },
        { key: 'net_margin', label: c('netMargin'), type: 'currency', total: true },
        { key: 'transactions_count', label: c('transactions'), type: 'number', total: true },
      ],
    };

    return [students, payments, payouts, commissions, catalog, taxes, performance];
  }, [t, scope, userId]);

  const loadSheet = useCallback(
    async (def: SheetDef) => {
      setLoading(prev => ({ ...prev, [def.key]: true }));
      try {
        const rows = await def.load();
        setData(prev => ({ ...prev, [def.key]: rows }));
      } catch {
        toast({ variant: 'destructive', description: t('sheets.loadError') });
      } finally {
        setLoading(prev => ({ ...prev, [def.key]: false }));
      }
    },
    [toast, t],
  );

  const [active, setActive] = useState(sheets[0].key);

  useEffect(() => {
    const def = sheets.find(s => s.key === active);
    if (def && !data[def.key] && !loading[def.key]) loadSheet(def);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, sheets]);

  const exportAll = async () => {
    setExporting(true);
    try {
      const loaded = await Promise.all(
        sheets.map(async s => ({ def: s, rows: data[s.key] ?? (await s.load()) })),
      );
      const visibleColumns = (def: SheetDef) => def.columns.filter(col => !(col.hidden && scope === 'team'));

      const cover = {
        name: t('sheets.cover', 'Contents'),
        title: t('sheets.title'),
        subtitle: t('sheets.subtitle'),
        columns: [
          { header: t('sheets.coverSheet', 'Report'), type: 'text' as const },
          { header: t('sheets.coverRecords', 'Records'), type: 'number' as const },
          { header: t('sheets.coverScope', 'Scope'), type: 'text' as const },
        ],
        rows: loaded.map(({ def, rows }) => [
          def.label,
          rows.length,
          scope === 'team' ? t('sheets.scopeTeam', 'Assigned to me') : t('sheets.scopeAdmin', 'All records'),
        ]),
      };

      await exportCorporateWorkbook({
        fileName: `DARB-${scope}-report-${new Date().toISOString().slice(0, 10)}`,
        title: t('sheets.title'),
        subtitle: t('sheets.subtitle'),
        author,
        locale,
        rtl,
        sheets: [
          cover,
          ...loaded.map(({ def, rows }) => ({
            name: def.label,
            title: def.label,
            subtitle: t(`sheets.desc.${def.key}`, ''),
            columns: toExportColumns(visibleColumns(def)),
            rows: toExportRows(rows, visibleColumns(def), translate),
          })),
        ],
      });
    } catch {
      toast({ variant: 'destructive', description: t('sheets.exportFailed') });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-full">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('sheets.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('sheets.subtitle')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportAll} disabled={exporting}>
          <Download className="h-4 w-4 me-1" />
          {exporting ? t('sheets.preparing') : t('sheets.exportWorkbook')}
        </Button>
      </div>

      <Tabs value={active} onValueChange={setActive}>
        <TabsList className="flex-wrap h-auto">
          {sheets.map(s => (
            <TabsTrigger key={s.key} value={s.key}>
              {s.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {sheets.map(s => (
          <TabsContent key={s.key} value={s.key} className="mt-4">
            <SheetTable
              title={s.label}
              description={t(`sheets.desc.${s.key}`, '')}
              columns={s.columns.filter(col => !(col.hidden && scope === 'team'))}
              rows={data[s.key] ?? []}
              loading={!!loading[s.key]}
              onRefresh={() => loadSheet(s)}
              fileName={`DARB-${s.key}-${new Date().toISOString().slice(0, 10)}`}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default SpreadsheetHub;
