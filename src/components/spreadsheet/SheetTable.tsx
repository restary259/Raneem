import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RefreshCw, Settings2, Search, FileText } from 'lucide-react';
import { useExportContext } from '@/utils/export/useExportContext';
import { buildCurrentViewReport, deliverReport, type ExportFormat } from './spreadsheetExport';
import SheetExportMenu, { type ExtraExportScope } from './SheetExportMenu';
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
  /** Additional export scopes offered by the parent workspace. */
  extraExportScopes?: ExtraExportScope[];
  /** The parent workspace is preparing an export. */
  busy?: boolean;
  /** External filters are owned by the parent; used only for a better empty state. */
  externalFiltersActive?: boolean;
  onClearExternalFilters?: () => void;
}

export type { ExportFormat };

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


interface ToolbarControlsProps {
  onRefresh?: () => void;
  refreshing: boolean;
  columns: SheetColumn[];
  visible: Set<string>;
  onToggle: (key: string) => void;
  children: React.ReactNode;
}

/** Refresh + column picker + export controls, shared by both layouts. */
const SheetToolbarControls: React.FC<ToolbarControlsProps> = ({ onRefresh, refreshing, columns, visible, onToggle, children }) => {
  const { t } = useTranslation('dashboard');
  return (
    <div className="flex gap-2 flex-wrap">
      {onRefresh && (
        <Button variant="outline" size="sm" onClick={onRefresh} aria-label={t('sheets.refresh')} disabled={refreshing}>
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
                <Checkbox checked={visible.has(c.key)} onCheckedChange={() => onToggle(c.key)} />
                <span>{c.label}</span>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      {children}
    </div>
  );
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
  extraExportScopes,
  busy = false,
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

  /** Export the rows currently shown (search + parent filters) with the chosen columns. */
  const exportCurrent = async (format: ExportFormat, selected: SheetColumn[] = activeColumns) => {
    if (!selected.length) {
      toast({ variant: 'destructive', description: t('sheets.exportNoColumns', 'Choose at least one column.') });
      return;
    }
    setExporting(true);
    try {
      const report = buildCurrentViewReport({
        fileName,
        title,
        description,
        columns: selected,
        rows: filteredRows,
        translate,
        author,
        locale,
        rtl,
        labels: {
          total: t('sheets.total'),
          empty: t('sheets.noRecords', 'No records'),
          continued: t('sheets.pdfPart', 'part'),
        },
      });
      const { empty, rtlFontMissing } = await deliverReport(format, report);
      if (empty) {
        toast({
          description:
            format === 'xlsx'
              ? t('sheets.emptyTemplate', 'Downloaded an empty template — no rows matched the current view.')
              : t('sheets.emptyPdf', 'No rows match the current view, so no PDF was created.'),
        });
      } else if (rtlFontMissing) {
        toast({ variant: 'destructive', description: t('sheets.pdfFontWarning') });
      }
    } catch {
      toast({ variant: 'destructive', description: t('sheets.exportFailed', 'Could not create the export file') });
    } finally {
      setExporting(false);
    }
  };

  const working = exporting || busy;

  const toolbarControls = (
    <SheetToolbarControls
      onRefresh={onRefresh}
      refreshing={!!loading}
      columns={columns}
      visible={visible}
      onToggle={toggle}
    >
      <SheetExportMenu
        columns={columns}
        visibleColumns={activeColumns}
        rowCount={filteredRows.length}
        busy={working}
        extraScopes={extraExportScopes}
        onExportCurrent={exportCurrent}
      />
    </SheetToolbarControls>
  );

  return (
    <section className="space-y-3" aria-label={title}>
      <div className="flex items-center justify-end">{toolbarControls}</div>
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
          <div className="flex min-h-[160px] flex-col items-center justify-center p-8 text-center">
            <FileText className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm font-medium text-foreground">
              {search.trim() || externalFiltersActive ? t('sheets.noMatches', 'No rows match your filters or search') : t('sheets.empty')}
            </p>
            {(search.trim() || externalFiltersActive) && (
              <>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('sheets.noMatchesHelp', 'Try changing your filters or search.')}
                </p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {search.trim() && (
                    <Button variant="ghost" size="sm" onClick={() => setSearch('')}>
                      {t('sheets.clearSearch', 'Clear search')}
                    </Button>
                  )}
                  {externalFiltersActive && onClearExternalFilters && (
                    <Button variant="ghost" size="sm" onClick={onClearExternalFilters}>
                      {t('sheets.clearFilters')}
                    </Button>
                  )}
                </div>
              </>
            )}
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
    </section>
  );
};

export default SheetTable;
