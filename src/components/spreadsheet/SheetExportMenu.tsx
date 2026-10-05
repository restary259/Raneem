import React, { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown, Download } from 'lucide-react';
import type { SheetColumn } from './SheetTable';
import type { ExportFormat } from './spreadsheetExport';

/** An additional export scope supplied by the workspace (e.g. Full report). */
export interface ExtraExportScope {
  value: string;
  label: string;
  help?: string;
  /** Disable this scope when the current sheet has no rows. */
  requiresRows?: boolean;
  run: (format: ExportFormat) => Promise<void>;
}

interface Props {
  columns: SheetColumn[];
  visibleColumns: SheetColumn[];
  rowCount: number;
  busy: boolean;
  extraScopes?: ExtraExportScope[];
  onExportCurrent: (format: ExportFormat, columns: SheetColumn[]) => Promise<void>;
}

const CURRENT = 'current';

const optionClass =
  'flex w-full cursor-pointer items-start gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/10';

/**
 * Generic export menu. Every time it opens it starts again from
 * "Current view + Excel + visible columns" so a previous broad export is never
 * silently reused.
 */
const SheetExportMenu: React.FC<Props> = ({ columns, visibleColumns, rowCount, busy, extraScopes = [], onExportCurrent }) => {
  const { t } = useTranslation('dashboard');
  const id = useId();
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>('xlsx');
  const [scope, setScope] = useState<string>(CURRENT);
  const [columnsMode, setColumnsMode] = useState<'visible' | 'custom'>('visible');
  const [custom, setCustom] = useState<Set<string>>(new Set());

  const reset = () => {
    setFormat('xlsx');
    setScope(CURRENT);
    setColumnsMode('visible');
    setCustom(new Set(visibleColumns.map(c => c.key)));
  };

  const onOpenChange = (next: boolean) => {
    if (next) reset();
    setOpen(next);
  };

  const extra = extraScopes.find(s => s.value === scope);
  const selectedColumns = columnsMode === 'visible' ? visibleColumns : columns.filter(c => custom.has(c.key));
  const noColumns = scope === CURRENT && selectedColumns.length === 0;
  // A workspace scope may need rows (e.g. a packet that merges several tables).
  // "Current view" is deliberately exportable with zero rows: the workbook engine
  // still writes the chosen columns as an empty template when no rows match.
  const extraNeedsRows = !!extra?.requiresRows && rowCount === 0;
  const disabled = busy || noColumns || extraNeedsRows;
  const emptyTemplate = scope === CURRENT && rowCount === 0 && !noColumns;

  const submit = async () => {
    if (extra) await extra.run(format);
    else await onExportCurrent(format, selectedColumns);
    setOpen(false);
  };

  const toggleCustom = (key: string) =>
    setCustom(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button size="sm" disabled={busy}>
          <Download className="h-4 w-4 me-1" />
          {busy ? t('sheets.preparing') : t('sheets.export', 'Export')}
          <ChevronDown className="h-4 w-4 ms-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="flex max-h-[min(var(--radix-popover-content-available-height,calc(100dvh-2rem)),calc(100dvh-2rem))] w-[min(340px,calc(100vw-2rem))] flex-col p-3.5"
        align="end"
        side="bottom"
        collisionPadding={12}
        avoidCollisions
      >
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
          <div>
            <p className="font-semibold text-sm">{t('sheets.export', 'Export')}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t('sheets.exportHelp', 'Choose the format, scope and columns for your download.')}
            </p>
          </div>

          <fieldset className="space-y-2">
            <legend id={`${id}-format`} className="text-xs font-medium text-muted-foreground mb-2">
              {t('sheets.exportFormat', 'Format')}
            </legend>
            <RadioGroup
              aria-labelledby={`${id}-format`}
              value={format}
              onValueChange={v => setFormat(v as ExportFormat)}
              className="grid grid-cols-2 gap-2"
            >
              {([
                ['xlsx', t('sheets.exportFormatExcel', 'Excel (.xlsx)')],
                ['pdf', t('sheets.exportFormatPdf', 'PDF (.pdf)')],
              ] as const).map(([value, label]) => (
                <Label key={value} htmlFor={`${id}-fmt-${value}`} className={`${optionClass} items-center font-medium`}>
                  <RadioGroupItem id={`${id}-fmt-${value}`} value={value} />
                  <span className="min-w-0">{label}</span>
                </Label>
              ))}
            </RadioGroup>
          </fieldset>

          <fieldset className="space-y-2">
            <legend id={`${id}-scope`} className="text-xs font-medium text-muted-foreground mb-2">
              {t('sheets.exportType', 'Export type')}
            </legend>
            <RadioGroup aria-labelledby={`${id}-scope`} value={scope} onValueChange={setScope} className="gap-1.5">
              {[
                { value: CURRENT, label: t('sheets.exportCurrentView', 'Current view'), help: t('sheets.exportCurrentViewHelp', 'Current filters, search and visible rows') },
                ...extraScopes,
              ].map(opt => (
                <Label key={opt.value} htmlFor={`${id}-scope-${opt.value}`} className={`${optionClass} font-normal`}>
                  <RadioGroupItem id={`${id}-scope-${opt.value}`} value={opt.value} className="mt-0.5" />
                  <span className="min-w-0">
                    <span className="block font-medium">{opt.label}</span>
                    {opt.help && <span className="block text-xs text-muted-foreground">{opt.help}</span>}
                  </span>
                </Label>
              ))}
            </RadioGroup>
          </fieldset>

          {scope === CURRENT && (
            <fieldset className="space-y-2">
              <legend id={`${id}-cols`} className="text-xs font-medium text-muted-foreground mb-2">
                {t('sheets.exportColumns', 'Columns')}
              </legend>
              <RadioGroup
                aria-labelledby={`${id}-cols`}
                value={columnsMode}
                onValueChange={v => setColumnsMode(v as 'visible' | 'custom')}
                className="gap-1.5"
              >
                <Label htmlFor={`${id}-cols-visible`} className={`${optionClass} font-medium`}>
                  <RadioGroupItem id={`${id}-cols-visible`} value="visible" />
                  <span>{t('sheets.exportVisibleColumns', 'Current visible columns')}</span>
                </Label>
                <Label htmlFor={`${id}-cols-custom`} className={`${optionClass} font-medium`}>
                  <RadioGroupItem id={`${id}-cols-custom`} value="custom" />
                  <span>{t('sheets.exportChooseColumns', 'Choose columns')}</span>
                </Label>
              </RadioGroup>
              {columnsMode === 'custom' && (
                <div className="max-h-44 space-y-1 overflow-auto rounded-lg border border-border p-2">
                  {columns.map(c => (
                    <label key={c.key} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted">
                      <Checkbox checked={custom.has(c.key)} onCheckedChange={() => toggleCustom(c.key)} />
                      <span>{c.label}</span>
                    </label>
                  ))}
                </div>
              )}
              {noColumns && (
                <p role="alert" className="text-xs text-destructive">
                  {t('sheets.exportNoColumns', 'Choose at least one column.')}
                </p>
              )}
              {emptyTemplate && (
                <p className="rounded-md bg-muted px-2 py-1.5 text-xs text-muted-foreground">
                  {t('sheets.exportEmptyTemplate', 'No rows match the current view. The file downloads as an empty template with your chosen columns.')}
                </p>
              )}
            </fieldset>
          )}

          {extraNeedsRows && (
            <p role="alert" className="text-xs text-muted-foreground">
              {t('sheets.exportNeedsRows', 'This export needs at least one matching row. Adjust the filters or search to include data.')}
            </p>
          )}
        </div>

        <div className="mt-3 shrink-0 border-t border-border pt-3">
          <Button className="w-full" onClick={() => void submit()} disabled={disabled}>
            <Download className="h-4 w-4 me-2" />
            {busy ? t('sheets.preparing') : t('sheets.export', 'Export')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default SheetExportMenu;
