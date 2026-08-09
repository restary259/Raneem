import ExcelJS from 'exceljs';
import {
  BRAND,
  COLORS,
  FONTS,
  LAYOUT,
  STATUS_TINTS,
  statusTone,
  thinBorder,
} from './theme';
import {
  ExportColumnType,
  CurrencyCode,
  alignmentFor,
  coerceValue,
  generatedStamp,
  numFmtFor,
} from './formats';

export interface ExportColumn {
  /** Column heading shown in the sheet. */
  header: string;
  /** Key used when rows are supplied as objects. */
  key?: string;
  type?: ExportColumnType;
  currency?: CurrencyCode;
  width?: number;
  /** Add this column to the totals row. */
  total?: 'sum' | 'count' | 'avg';
  /** Render a data bar across the column (numeric columns only). */
  dataBar?: boolean;
}

export type ExportRow = Record<string, unknown> | unknown[];

export interface CorporateSheet {
  /** Worksheet tab name. */
  name: string;
  /** Report title printed above the table. Falls back to the tab name. */
  title?: string;
  subtitle?: string;
  columns: ExportColumn[];
  rows: ExportRow[];
}

export interface CorporateReport {
  fileName: string;
  title: string;
  subtitle?: string;
  /** Signed-in user's display name; omitted when unknown. */
  author?: string;
  /** Arabic reports open right-to-left in Excel. */
  rtl?: boolean;
  locale?: string;
  sheets: CorporateSheet[];
}

const sanitizeSheetName = (name: string, index: number) =>
  (name || `Sheet ${index + 1}`).replace(/[\[\]:*?/\\]/g, ' ').trim().slice(0, 31) || `Sheet ${index + 1}`;

const sanitizeTableName = (name: string, index: number) =>
  `T${index}_${(name || 'Data').replace(/[^A-Za-z0-9]/g, '')}`.slice(0, 30);

const colLetter = (index: number) => {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

const toCells = (row: ExportRow, columns: ExportColumn[]) =>
  Array.isArray(row)
    ? columns.map((c, i) => coerceValue(row[i], c.type))
    : columns.map(c => coerceValue(c.key ? (row as Record<string, unknown>)[c.key] : undefined, c.type));

const displayLength = (value: unknown, type?: ExportColumnType) => {
  if (value === null || value === undefined) return 1;
  if (value instanceof Date) return type === 'datetime' ? 16 : 10;
  if (typeof value === 'number') return String(Math.round(value)).length + 6;
  // Arabic glyphs render wider than Latin ones in Excel's default metrics.
  const text = String(value);
  const arabic = (text.match(/[\u0600-\u06FF]/g) || []).length;
  return text.length + Math.round(arabic * 0.35);
};

/** Renders one corporate-styled worksheet: branded header, Excel table, totals, print setup. */
function renderSheet(
  wb: ExcelJS.Workbook,
  sheet: CorporateSheet,
  report: CorporateReport,
  index: number,
) {
  const columns = sheet.columns;
  const ws = wb.addWorksheet(sanitizeSheetName(sheet.name, index), {
    views: [{ rightToLeft: !!report.rtl, showGridLines: false }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: columns.length > LAYOUT.landscapeThreshold ? 'landscape' : 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      horizontalCentered: true,
      margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
    },
    headerFooter: {
      oddFooter: `&L${BRAND.confidentiality}&R Page &P of &N`,
      oddHeader: `&L&"Calibri,Bold"${BRAND.company}&R${sheet.title || sheet.name}`,
    },
  });

  const lastCol = colLetter(Math.max(columns.length - 1, 0));

  // ---- Branded header block -------------------------------------------------
  const titleRow = ws.addRow([sheet.title || sheet.name]);
  ws.mergeCells(`A${titleRow.number}:${lastCol}${titleRow.number}`);
  titleRow.height = LAYOUT.titleRowHeight;
  titleRow.getCell(1).font = { name: FONTS.family, size: FONTS.titleSize, bold: true, color: { argb: COLORS.navy } };
  titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: report.rtl ? 'right' : 'left' };

  const metaLines: string[] = [];
  metaLines.push(
    [BRAND.company, sheet.subtitle || report.subtitle]
      .filter(Boolean)
      .map(String)
      .join('  ·  '),
  );
  const stampParts = [`Generated ${generatedStamp(report.locale)} (${BRAND.timeZone})`];
  if (report.author) stampParts.push(`Exported by ${report.author}`);
  stampParts.push(`${sheet.rows.length} record${sheet.rows.length === 1 ? '' : 's'}`);
  metaLines.push(stampParts.join('  ·  '));

  // Left unmerged on purpose: merged cells clip overflow, these lines are longer
  // than the table width and must stay fully readable.
  for (const line of metaLines) {
    const metaRow = ws.addRow([line]);
    metaRow.getCell(1).font = { name: FONTS.family, size: FONTS.subtitleSize, color: { argb: COLORS.muted } };
    metaRow.getCell(1).alignment = { vertical: 'middle', horizontal: report.rtl ? 'right' : 'left' };
  }

  const ruleRow = ws.addRow([]);
  ruleRow.height = 6;
  for (let i = 0; i < columns.length; i++) {
    ruleRow.getCell(i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.gold } };
  }
  ws.addRow([]);

  // ---- Excel table ----------------------------------------------------------
  const headerRowNumber = ws.rowCount + 1;
  const body = sheet.rows.map(r => toCells(r, columns));
  const isEmpty = body.length === 0;
  // A totals row over a placeholder (empty) table makes Excel repair the table
  // and rewrite its SUBTOTAL formulas as #REF!, so totals only exist with data.
  const hasTotals = !isEmpty && columns.some(c => c.total);

  ws.addTable({
    name: sanitizeTableName(sheet.name, index),
    ref: `A${headerRowNumber}`,
    headerRow: true,
    totalsRow: hasTotals,
    style: { theme: 'TableStyleLight1', showRowStripes: true, showColumnStripes: false },
    columns: columns.map((c, i) => ({
      name: c.header || `Column ${i + 1}`,
      filterButton: true,
      totalsRowLabel: !hasTotals ? undefined : i === 0 ? 'Total' : undefined,
      totalsRowFunction: !hasTotals || !c.total
        ? undefined
        : c.total === 'sum'
          ? 'sum'
          : c.total === 'avg'
            ? 'average'
            : 'count',
    })),
    rows: body.length ? body : [columns.map(() => null)],
  });

  const firstDataRow = headerRowNumber + 1;
  const lastDataRow = headerRowNumber + Math.max(body.length, 1);
  const totalsRowNumber = hasTotals ? lastDataRow + 1 : null;

  if (isEmpty) {
    const placeholder = ws.getRow(firstDataRow).getCell(1);
    placeholder.value = 'No records for the current selection';
    placeholder.font = { name: FONTS.family, size: FONTS.bodySize, italic: true, color: { argb: COLORS.muted } };
  }


  // Header styling
  const header = ws.getRow(headerRowNumber);
  header.height = LAYOUT.headerRowHeight;
  columns.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.navy } };
    cell.font = { name: FONTS.family, size: FONTS.headerSize, bold: true, color: { argb: COLORS.white } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = thinBorder;
  });

  // Body styling
  const WRAP_THRESHOLD = 28;
  const wrapped = columns.map(
    (c, i) =>
      (c.type === undefined || c.type === 'text') &&
      body.some(r => String(r[i] ?? '').length > WRAP_THRESHOLD),
  );

  for (let r = firstDataRow; r <= lastDataRow; r++) {
    const row = ws.getRow(r);
    // Let Excel auto-fit the height when any cell wraps, otherwise long notes
    // and student lists are clipped by the fixed row height.
    const rowWraps = wrapped.some((w, i) => w && String(body[r - firstDataRow]?.[i] ?? '').length > WRAP_THRESHOLD);
    if (!rowWraps) row.height = LAYOUT.bodyRowHeight;
    const zebra = (r - firstDataRow) % 2 === 1;
    columns.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      cell.font = { name: FONTS.family, size: FONTS.bodySize, color: { argb: COLORS.text } };
      cell.alignment = { vertical: 'middle', horizontal: alignmentFor(c.type), wrapText: wrapped[i] };
      cell.border = thinBorder;
      const fmt = numFmtFor(c.type, c.currency);
      if (fmt) cell.numFmt = fmt;
      if (zebra) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.zebra } };
      if (c.type === 'status' && cell.value != null && cell.value !== '') {
        const tone = STATUS_TINTS[statusTone(cell.value)];
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: tone.fill } };
        cell.font = { name: FONTS.family, size: FONTS.bodySize, bold: true, color: { argb: tone.font } };
      }
    });
  }


  // Totals row styling
  if (totalsRowNumber) {
    const row = ws.getRow(totalsRowNumber);
    row.height = LAYOUT.bodyRowHeight + 2;
    columns.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      cell.font = { name: FONTS.family, size: FONTS.bodySize, bold: true, color: { argb: COLORS.navy } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.totalFill } };
      cell.alignment = { vertical: 'middle', horizontal: alignmentFor(c.type) };
      cell.border = {
        ...thinBorder,
        top: { style: 'double', color: { argb: COLORS.borderStrong } },
      };
      const fmt = numFmtFor(c.type, c.currency);
      if (fmt) cell.numFmt = fmt;
    });
  }

  // ---- Conditional formatting ----------------------------------------------
  columns.forEach((c, i) => {
    if (c.type !== 'currency' && c.type !== 'number' && c.type !== 'percent') return;
    const range = `${colLetter(i)}${firstDataRow}:${colLetter(i)}${lastDataRow}`;
    ws.addConditionalFormatting({
      ref: range,
      rules: [
        {
          type: 'cellIs',
          operator: 'lessThan',
          formulae: ['0'],
          priority: 1,
          style: { font: { color: { argb: COLORS.negative }, bold: true } },
        } as ExcelJS.ConditionalFormattingRule,
      ],
    });
    if (c.dataBar) {
      ws.addConditionalFormatting({
        ref: range,
        rules: [
          {
            type: 'dataBar',
            priority: 2,
            minLength: 0,
            maxLength: 100,
            color: { argb: COLORS.navy },
            gradient: true,
            showValue: true,
            border: false,
            negativeBarColorSameAsPositive: false,
            negativeBarBorderColorSameAsPositive: false,
            axisPosition: 'auto',
            direction: 'leftToRight',
            cfvo: [{ type: 'min' }, { type: 'max' }],
          } as unknown as ExcelJS.ConditionalFormattingRule,
        ],
      });
    }
  });

  // ---- Column widths & freeze panes -----------------------------------------
  columns.forEach((c, i) => {
    const longest = Math.max(
      c.header.length,
      ...body.map(r => displayLength(r[i], c.type)),
    );
    // Currency/date cells render wider than their raw value (₪1,234,567.00),
    // otherwise Excel shows ####.
    const padding = c.type === 'currency' ? 8 : c.type === 'date' || c.type === 'datetime' ? 6 : 4;
    const cap = wrapped[i] ? LAYOUT.maxColWidth : LAYOUT.maxColWidth;
    ws.getColumn(i + 1).width = c.width ?? Math.min(Math.max(longest + padding, LAYOUT.minColWidth), cap);
  });

  ws.views = [
    {
      state: 'frozen',
      ySplit: headerRowNumber,
      rightToLeft: !!report.rtl,
      showGridLines: false,
    },
  ];
  // No sheet-level autoFilter: the table already provides filter buttons over
  // the same range, and the duplicate makes Excel "repair" the table — which is
  // what turns the totals SUBTOTAL formulas into #REF!.

  // Repeat the header row on every printed page.
  (ws.pageSetup as unknown as { printTitlesRow?: string }).printTitlesRow = `${headerRowNumber}:${headerRowNumber}`;
}

/** Builds the styled workbook without touching the DOM (used by tests too). */
export async function buildCorporateWorkbook(report: CorporateReport): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = report.author || BRAND.company;
  wb.company = BRAND.company;
  wb.title = report.title;
  wb.description = report.subtitle || BRAND.confidentiality;
  wb.created = new Date();

  report.sheets.forEach((sheet, i) => renderSheet(wb, sheet, report, i));
  return wb;
}
