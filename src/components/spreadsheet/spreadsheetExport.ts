import { exportCorporateWorkbook, exportCorporatePdf, type CorporateReport } from '@/utils/export';
import { toExportColumns, toExportRows } from './exportMapping';
import type { SheetColumn, ValueTranslator } from './SheetTable';

export type ExportFormat = 'xlsx' | 'pdf';

export interface ExportOutcome {
  empty?: boolean;
  rtlFontMissing?: boolean;
}

/** One report definition, two file formats — both engines get identical data. */
export async function deliverReport(format: ExportFormat, report: CorporateReport): Promise<ExportOutcome> {
  if (format === 'xlsx') {
    await exportCorporateWorkbook(report);
    return {};
  }
  const { empty, rtlFontMissing } = await exportCorporatePdf(report);
  return { empty, rtlFontMissing };
}

export interface CurrentViewReportInput {
  fileName: string;
  title: string;
  description?: string;
  columns: SheetColumn[];
  rows: Record<string, unknown>[];
  translate: ValueTranslator;
  author?: string;
  locale?: string;
  rtl?: boolean;
  labels: { total: string; empty: string; continued: string };
}

/** Single-sheet report for "Current view": the given (already filtered) rows and chosen columns. */
export function buildCurrentViewReport(input: CurrentViewReportInput): CorporateReport {
  const { fileName, title, description, columns, rows, translate, author, locale, rtl, labels } = input;
  return {
    fileName,
    title,
    subtitle: description,
    author,
    locale,
    rtl,
    totalLabel: labels.total,
    emptyLabel: labels.empty,
    continuedLabel: labels.continued,
    sheets: [
      {
        name: title,
        title,
        subtitle: description,
        columns: toExportColumns(columns),
        rows: toExportRows(rows, columns, translate),
      },
    ],
  } as CorporateReport;
}
