import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RefreshCw, Settings2, Download, Search, FileText } from 'lucide-react';
import { exportXLSX } from '@/utils/exportUtils';
import { useToast } from '@/hooks/use-toast';

import { SheetEnumGroup, useSheetLabels } from './sheetLabels';

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
}

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

const STATUS_TONE: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-purple-100 text-purple-800',
  appointment_scheduled: 'bg-indigo-100 text-indigo-800',
  profile_completion: 'bg-yellow-100 text-yellow-800',
  payment_confirmed: 'bg-emerald-100 text-emerald-800',
  submitted: 'bg-cyan-100 text-cyan-800',
  enrollment_paid: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  forgotten: 'bg-gray-100 text-gray-700',
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
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
}) => {
  const { t } = useTranslation('dashboard');
  const { translate } = useSheetLabels();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [visible, setVisible] = useState<Set<string>>(
    () => new Set(columns.filter(c => !c.hidden).map(c => c.key)),
  );

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

  const handleExport = async () => {
    try {
      await exportXLSX({
        headers: activeColumns.map(c => c.label),
        rows: filteredRows.map(r => activeColumns.map(c => formatCell(r[c.key], c, translate))),
        summaryRows: totals
          ? [
              activeColumns.map(c =>
                c.total ? formatCell(totals[c.key], c, translate) : c === activeColumns[0] ? t('sheets.total') : '',
              ),
            ]
          : undefined,
        fileName,
        title,
      });
    } catch {
      toast({ variant: 'destructive', description: t('sheets.exportFailed') });
    }
  };

  return (
    <div className="space-y-3">
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
          <Button size="sm" onClick={handleExport} disabled={!filteredRows.length}>
            <Download className="h-4 w-4 me-1" />
            {t('sheets.exportExcel')}
          </Button>
        </div>
      </div>

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
                            STATUS_TONE[String(r[c.key]).toLowerCase()] ?? 'bg-muted text-muted-foreground'
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
