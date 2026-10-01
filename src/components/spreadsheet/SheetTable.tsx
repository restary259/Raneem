import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RefreshCw, Settings2, Download, Search, FileText, ChevronDown } from 'lucide-react';
import { exportCorporateWorkbook, exportCorporatePdf } from '@/utils/export';
import { useExportContext } from '@/utils/export/useExportContext';
import { toExportColumns, toExportRows } from './exportMapping';
import { useToast } from '@/hooks/use-toast';

import { SheetEnumGroup, useSheetLabels } from './sheetLabels';
import { toneClasses, toneForStatus, type StatusTone } from '@/lib/statusTokens';

export type SheetColumnType = 'text' | 'number' | 'currency' | 'date' | 'percent' | 'enum';

export interface SheetColumn {
  key: string;
  label: string;
  type?: SheetColumnType;
  /** Value dictionary used when type is 'enum' */
  enumGroup?: SheetEnumGroup;
  currency?: string;
  /** Exclude from the default visible set */
  hidden?: boolean;
  /** Sum this column in the totals row */
  total?: boolean;
}

export interface SheetTableProps {
  title: string;
  description?: string;
  columns: SheetColumn[];
  rows: Record<string, any>[];
  loading?: boolean;
  onRefresh?: () => void;
  fileName: string;
  /** Extra toolbar controls (filters) */
  toolbar?: React.ReactNode;
  /** Hide the visual sheet title when the parent workspace already provides the context. */
  showTitle?: boolean;
  /** Parent-level exports available from the streamlined Admin export menu. */
  onExportFullReport?: (format: ExportFormat) => Promise<void>;
  onExportSchoolPacket?: (format: ExportFormat) => Promise<void>;
  parentExporting?: boolean;
  /** External filters are owned by SpreadsheetHub; used only for a better empty state. */
  externalFiltersActive?: boolean;
  onClearExternalFilters?: () => void;
}

export type ExportFormat = 'xlsx' | 'pdf';

export type ValueTranslator = (group: SheetEnumGroup, value: unknown) => string;

export const formatCell = (
  value: any,
  col: SheetColumn,
  translate?: ValueTranslator,
): string => {
  if (col.type === 'enum' && translate) return translate(col.enumGroup ?? 'status', value);
  if (value === null || value === undefined || value === '') return '—';
  switch (col.type) {
    case 'currency': {
      const n = Number(value) || 0;
      return `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${col.currency ?? 'ILS'}`;
    }
    case 'number':
      return (Number(value) || 0).toLocaleString('en-US');
    case 'percent':
      return `${(Number(value) || 0).toLocaleString('en-US', { maximumFractionDigits: 1 })}%`;
    case 'date': {
      const d = new Date(value);
      return isNaN(d.getTime()) ? String(value) : d.toISOString().slice(0, 10);
    }
    default:
      return String(value);
  }
};

/** Status key → theme-aware chip class. Confirmed money (`paid`) uses the
 *  dedicated `paid` tone; other keys resolve through the shared tone map. */
const chipForStatus = (raw: string): string => {
  const key = raw.toLowerCase();
  if (key === "paid" || key === "enrollment_paid") return toneClasses("paid").chip;
  const tone: StatusTone = toneForStatus(key);
  return toneClasses(tone).chip;
};


const SheetTable: React.FC<SheetTableProps> = ({
  title,
  description,
  columns,
  rows,
  loading,
  onRefresh,
  fileName,
  toolbar,
  showTitle = true,
  onExportFullReport,
  onExportSchoolPacket,
  parentExporting = false,
  externalFiltersActive = false,
  onClearExternalFilters,
}) => {
  const { t } = useTranslation('dashboard');
  const { translate } = useSheetLabels();
  const { author, locale, rtl } = useExportContext();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [visible, setVisible] = useState<Set<string>>(
    () => new Set(columns.filter(c => !c.hidden).map(c => c.key)),
  );
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xlsx');
  const [exportKind, setExportKind] = useState<'current' | 'full' | 'schoolPacket'>('current');
  const [exportColumnsMode, setExportColumnsMode] = useState<'visible' | 'custom'>('visible');
  const [exportColumns, setExportColumns] = useState<Set<string>>(
    () => new Set(columns.filter(c => !c.hidden).map(c => c.key)),
  );
  const [exporting, setExporting] = useState(false);

  const activeColumns = useMemo(
    () => columns.filter(c => visible.has(c.key)),
    [columns, visible],
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      activeColumns.some(c => formatCell(r[c.key], c, translate).toLowerCase().includes(q)),
    );
  }, [rows, search, activeColumns, translate]);

  const totals = useMemo(() => {
    const cols = activeColumns.filter(c => c.total);
    if (!cols.length) return null;
    const map: Record<string, number> = {};
    cols.forEach(c => {
      map[c.key] = filteredRows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0);
    });
    return map;
  }, [activeColumns, filteredRows]);

  const toggle = (key: string) =>
    setVisible(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const toggleExportColumn = (key: string) =>
    setExportColumns(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  /** One report definition drives both the Excel and the PDF download. */
  const buildReport = () => {
    const rowsOut = toExportRows(filteredRows, activeColumns, translate);
    return {
      fileName,
      title,
      subtitle: description,
      author,
      locale,
      rtl,
      totalLabel: t('sheets.total'),
      emptyLabel: t('sheets.noRecords', 'No records'),
      continuedLabel: t('sheets.pdfPart', 'part'),
      sheets: [
        {
          name: title,
          title,
          subtitle: description,
          columns: toExportColumns(activeColumns),
          rows: rowsOut,
        },
      ],
    };
  };

  const handleExport = async () => {
    const hasColumns = exportKind !== 'current' || (exportColumnsMode === 'visible'
      ? activeColumns.length > 0
      : exportColumns.size > 0);
    if (!hasColumns) {
      toast({ variant: 'destructive', description: t('sheets.exportNoColumns', 'Choose at least one column.') });
      return;
    }

    setExporting(true);
    try {
      if (exportKind === 'full' && onExportFullReport) {
        await onExportFullReport(exportFormat);
        return;
      }

      if (exportKind === 'schoolPacket' && onExportSchoolPacket) {
        await onExportSchoolPacket(exportFormat);
        return;
      }

      const selectedColumns = exportColumnsMode === 'visible'
        ? activeColumns
        : columns.filter(c => exportColumns.has(c.key));

      const report = buildReport();
      report.sheets[0].columns = toExportColumns(selectedColumns);
      report.sheets[0].rows = toExportRows(filteredRows, selectedColumns, translate);

      if (exportFormat === 'xlsx') {
        await exportCorporateWorkbook(report);
      } else {
        const { empty, rtlFontMissing } = await exportCorporatePdf(report);
        if (empty) toast({ description: t('sheets.empty') });
        else if (rtlFontMissing) toast({ variant: 'destructive', description: t('sheets.pdfFontWarning') });
      }
    } catch {
      toast({ variant: 'destructive', description: t('sheets.exportFailed', 'Could not create the export file') });
    } finally {
      setExporting(false);
    }
  };


  return (
    <div className="space-y-3">
      {showTitle && (
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
          <div className="flex gap-2 flex-wrap">
            {onRefresh && (
              <Button variant="outline" size="sm" onClick={onRefresh} aria-label={t('sheets.refresh')}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings2 className="h-4 w-4 me-1" />
                  {t('sheets.columns')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 max-h-80 overflow-auto" align="end">
                <div className="space-y-2">
                  {columns.map(c => (
                    <label key={c.key} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={visible.has(c.key)} onCheckedChange={() => toggle(c.key)} />
                      <span>{c.label}</span>
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <Button size="sm" onClick={() => { setExportKind('current'); setExportFormat('xlsx'); void handleExport(); }} disabled={exporting || parentExporting}>
              <Download className="h-4 w-4 me-1" />
              {t('sheets.exportExcel')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setExportKind('current'); setExportFormat('pdf'); void handleExport(); }} disabled={!filteredRows.length || exporting || parentExporting}>
              <FileText className="h-4 w-4 me-1" />
              {t('sheets.exportPdf')}
            </Button>
          </div>
        </div>
      )}

      {!showTitle && (
        <div className="flex items-center justify-end gap-2 flex-wrap">
          <h2 className="sr-only">{title}</h2>
          {onRefresh && (
            <Button variant="outline" size="sm" onClick={onRefresh} aria-label={t('sheets.refresh')} disabled={loading}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings2 className="h-4 w-4 me-1" />
                {t('sheets.columns')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 max-h-80 overflow-auto" align="end">
              <div className="space-y-2">
                {columns.map(c => (
                  <label key={c.key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={visible.has(c.key)} onCheckedChange={() => toggle(c.key)} />
                    <span>{c.label}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" disabled={!filteredRows.length || exporting || parentExporting}>
                <Download className="h-4 w-4 me-1" />
                {exporting || parentExporting ? t('sheets.preparing') : t('sheets.export', 'Export')}
                <ChevronDown className="h-4 w-4 ms-1" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[340px] p-4" align="end">
              <div className="space-y-4">
                <div>
                  <p className="font-semibold text-sm">{t('sheets.export', 'Export')}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t('sheets.exportHelp', 'Choose the format, scope and columns for your download.')}</p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">{t('sheets.exportFormat', 'Format')}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      ['xlsx', t('sheets.exportFormatExcel', 'Excel (.xlsx)')],
                      ['pdf', t('sheets.exportFormatPdf', 'PDF (.pdf)')],
                    ] as const).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setExportFormat(value)}
                        className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                          exportFormat === value ? 'border-primary bg-primary/10 text-foreground' : 'border-border hover:bg-muted'
                        }`}
                        aria-pressed={exportFormat === value}
                      >
                        {value === 'xlsx' ? <Download className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">{t('sheets.exportType', 'Export type')}</p>
                  <div className="space-y-1.5">
                    <button type="button" onClick={() => setExportKind('current')} className={`w-full rounded-lg border px-3 py-2 text-start text-sm ${exportKind === 'current' ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'}`}>
                      <span className="font-medium">{t('sheets.exportCurrentView', 'Current view')}</span>
                      <span className="block text-xs text-muted-foreground">{t('sheets.exportCurrentViewHelp', 'Current filters, search and visible rows')}</span>
                    </button>
                    {onExportFullReport && (
                      <button type="button" onClick={() => setExportKind('full')} className={`w-full rounded-lg border px-3 py-2 text-start text-sm ${exportKind === 'full' ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'}`}>
                        <span className="font-medium">{t('sheets.exportFullReport', 'Full report')}</span>
                        <span className="block text-xs text-muted-foreground">{t('sheets.exportFullReportHelp', 'All spreadsheet tabs')}</span>
                      </button>
                    )}
                    {onExportSchoolPacket && (
                      <button type="button" onClick={() => setExportKind('schoolPacket')} className={`w-full rounded-lg border px-3 py-2 text-start text-sm ${exportKind === 'schoolPacket' ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'}`}>
                        <span className="font-medium">{t('sheets.exportSchoolPacket', 'School packet')}</span>
                        <span className="block text-xs text-muted-foreground">{t('sheets.exportSchoolPacketHelp', 'Student details and costs for schools')}</span>
                      </button>
                    )}
                  </div>
                </div>

                {exportKind === 'current' && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">{t('sheets.exportColumns', 'Columns')}</p>
                    <div className="space-y-1.5">
                      <button type="button" onClick={() => { setExportColumnsMode('visible'); setExportColumns(new Set(activeColumns.map(c => c.key))); }} className={`w-full rounded-lg border px-3 py-2 text-start text-sm ${exportColumnsMode === 'visible' ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'}`}>
                        <span className="font-medium">{t('sheets.exportVisibleColumns', 'Current visible columns')}</span>
                      </button>
                      <button type="button" onClick={() => { setExportColumnsMode('custom'); setExportColumns(prev => prev.size ? prev : new Set(activeColumns.map(c => c.key))); }} className={`w-full rounded-lg border px-3 py-2 text-start text-sm ${exportColumnsMode === 'custom' ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'}`}>
                        <span className="font-medium">{t('sheets.exportChooseColumns', 'Choose columns')}</span>
                      </button>
                    </div>
                    {exportColumnsMode === 'custom' && (
                      <div className="max-h-44 space-y-1 overflow-auto rounded-lg border border-border p-2">
                        {columns.map(c => (
                          <label key={c.key} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted">
                            <Checkbox checked={exportColumns.has(c.key)} onCheckedChange={() => toggleExportColumn(c.key)} />
                            <span>{c.label}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <Button className="w-full" onClick={() => void handleExport()} disabled={
                  exporting ||
                  parentExporting ||
                  ((exportKind === 'current' || exportKind === 'schoolPacket') && !filteredRows.length) ||
                  (exportKind === 'current' && (exportColumnsMode === 'visible' ? activeColumns.length === 0 : exportColumns.size === 0))
                }>
                  <Download className="h-4 w-4 me-2" />
                  {exporting || parentExporting ? t('sheets.preparing') : t('sheets.export', 'Export')}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}
      <div className="flex items-center gap-3 flex-wrap p-3 rounded-lg bg-muted/40 border border-border">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('sheets.searchPlaceholder')}
            className="h-8 ps-8 text-sm"
          />
        </div>
        {toolbar}
        <span className="text-xs text-muted-foreground ms-auto">
          {filteredRows.length.toLocaleString('en-US')} {t('sheets.rows')}
        </span>
      </div>

      <div className="rounded-lg border border-border overflow-auto">
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">{t('sheets.loading')}</div>
        ) : filteredRows.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">{t('sheets.empty')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr>
                {activeColumns.map(c => (
                  <th
                    key={c.key}
                    className="px-3 py-2 text-start font-medium text-xs whitespace-nowrap text-muted-foreground"
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r, i) => (
                <tr key={r.id ?? i} className="border-t border-border hover:bg-muted/30">
                  {activeColumns.map(c => (
                    <td key={c.key} className="px-3 py-2 whitespace-nowrap">
                      {c.type === 'enum' && (c.enumGroup ?? 'status') === 'status' && r[c.key] ? (
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            chipForStatus(String(r[c.key])) ?? 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {formatCell(r[c.key], c, translate)}
                        </span>
                      ) : (
                        formatCell(r[c.key], c, translate)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {totals && (
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/50 font-semibold">
                  {activeColumns.map((c, idx) => (
                    <td key={c.key} className="px-3 py-2 whitespace-nowrap">
                      {c.total ? formatCell(totals[c.key], c, translate) : idx === 0 ? t('sheets.total') : ''}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        )}
      </div>
    </div>
  );
};

export default SheetTable;
