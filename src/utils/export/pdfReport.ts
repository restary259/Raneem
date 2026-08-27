/**
 * Single PDF path for every Darb tabular export.
 *
 * Consumes the exact same `CorporateReport` object as
 * `exportCorporateWorkbook`, so the Excel and PDF versions of a report can
 * never drift apart: same title, same columns, same rows, same totals.
 *
 * Arabic / Hebrew are rendered with the bundled Unicode faces (Helvetica has
 * no glyphs for either script). When RTL text is present but no face could be
 * registered we report it back instead of emitting an unreadable document.
 */

import { BRAND, LAYOUT } from './theme';
import { CorporateReport, CorporateSheet, ExportColumn, ExportRow } from './corporateSheet';
import { ExportColumnType, coerceValue, generatedStamp } from './formats';
import { fontForText, hasRtl, registerPdfFonts, shapeForPdf, type FontRegistration } from '@/utils/pdfFonts';

export interface PdfReportResult {
  /** True when RTL text was present but no font could render it. */
  rtlFontMissing: boolean;
  /** True when the report had no data rows — nothing was downloaded. */
  empty: boolean;
}

const CURRENCY_SYMBOL: Record<string, string> = { ILS: '₪', EUR: '€' };
const DASH = '—';

/** Numerals stay Western in every locale so money is never ambiguous. */
const numberLocale = 'en-US';

export function formatPdfValue(
  value: unknown,
  type: ExportColumnType | undefined,
  currency?: string,
): string {
  const coerced = coerceValue(value, type);
  if (coerced === null) return DASH;

  switch (type) {
    case 'currency':
      return typeof coerced === 'number'
        ? `${coerced.toLocaleString(numberLocale, { maximumFractionDigits: 2 })} ${CURRENCY_SYMBOL[currency ?? 'ILS'] ?? '₪'}`
        : String(coerced);
    case 'number':
      return typeof coerced === 'number' ? coerced.toLocaleString(numberLocale) : String(coerced);
    case 'percent':
      return typeof coerced === 'number'
        ? `${coerced.toLocaleString(numberLocale, { maximumFractionDigits: 1 })}%`
        : String(coerced);
    case 'date':
      return coerced instanceof Date ? coerced.toLocaleDateString('en-GB') : String(coerced);
    case 'datetime':
      return coerced instanceof Date
        ? `${coerced.toLocaleDateString('en-GB')} ${coerced.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
        : String(coerced);
    default:
      return String(coerced);
  }
}

const cellsOf = (row: ExportRow, columns: ExportColumn[]): unknown[] =>
  Array.isArray(row)
    ? columns.map((_, i) => row[i])
    : columns.map(c => (c.key ? (row as Record<string, unknown>)[c.key] : undefined));

/** Totals row mirroring the workbook's SUBTOTAL row, computed client-side. */
function totalsRow(sheet: CorporateSheet, totalLabel: string): string[] | null {
  const hasTotals = sheet.columns.some(c => c.total);
  if (!hasTotals || !sheet.rows.length) return null;

  const numeric = (value: unknown) => {
    const n = coerceValue(value, 'number');
    return typeof n === 'number' ? n : 0;
  };

  return sheet.columns.map((col, index) => {
    if (!col.total) return index === 0 ? totalLabel : '';
    const values = sheet.rows.map(row => numeric(cellsOf(row, sheet.columns)[index]));
    const sum = values.reduce((a, b) => a + b, 0);
    const value =
      col.total === 'count' ? values.length : col.total === 'avg' ? (values.length ? sum / values.length : 0) : sum;
    return formatPdfValue(value, col.total === 'count' ? 'number' : col.type, col.currency);
  });
}

/** Numeric / date columns must never wrap — reserve a sensible minimum. */
function minWidthFor(type: ExportColumnType | undefined): number | undefined {
  switch (type) {
    case 'currency':
      return 26;
    case 'date':
      return 24;
    case 'datetime':
      return 32;
    case 'number':
    case 'percent':
      return 20;
    case 'status':
      return 22;
    default:
      return undefined;
  }
}

export async function exportCorporatePdf(report: CorporateReport): Promise<PdfReportResult> {
  const sheets = report.sheets.filter(sheet => sheet.rows.length > 0);
  if (!sheets.length) return { rtlFontMissing: false, empty: true };

  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const rtl = !!report.rtl;
  const locale = report.locale === 'ar' ? 'ar' : report.locale || 'en-US';
  const widest = Math.max(...sheets.map(s => s.columns.length));
  const doc = new jsPDF({
    orientation: widest > LAYOUT.landscapeThreshold ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });
  const fonts: FontRegistration = await registerPdfFonts(doc);

  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 10;
  const alignStart = rtl ? 'right' : 'left';
  const xStart = rtl ? pageWidth - margin - 4 : margin + 4;

  let rtlFontMissing = false;
  const track = (text: string) => {
    if (hasRtl(text) && fontForText(text, fonts, '') === '') rtlFontMissing = true;
    return shapeForPdf(text);
  };

  const write = (text: string, x: number, y: number, size: number, color: number[]) => {
    doc.setFont(fontForText(text, fonts), 'normal');
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(track(text), x, y, { align: alignStart });
  };

  const totalLabel = report.totalLabel ?? 'Total';
  const stampParts = [
    `${BRAND.company}`,
    generatedStamp(locale),
    report.author ? `${report.author}` : null,
  ].filter(Boolean) as string[];

  sheets.forEach((sheet, index) => {
    if (index > 0) doc.addPage();

    let y = margin + 8;
    write(sheet.title || report.title, xStart, y, 15, [30, 58, 95]);
    y += 6;
    const subtitle = [sheet.subtitle, index === 0 ? report.subtitle : null].filter(Boolean).join(' · ');
    if (subtitle) {
      write(subtitle, xStart, y, 9, [107, 114, 128]);
      y += 5;
    }
    write(`${stampParts.join('  ·  ')}  ·  ${sheet.rows.length.toLocaleString(numberLocale)}`, xStart, y, 8, [
      150, 150, 150,
    ]);
    y += 4;

    const headers = sheet.columns.map(c => c.header);
    const body = sheet.rows.map(row =>
      cellsOf(row, sheet.columns).map((value, i) =>
        formatPdfValue(value, sheet.columns[i].type, sheet.columns[i].currency),
      ),
    );
    const totals = totalsRow(sheet, totalLabel);
    if (totals) body.push(totals);

    const displayHeaders = rtl ? [...headers].reverse() : headers;
    const displayBody = rtl ? body.map(r => [...r].reverse()) : body;
    const displayColumns = rtl ? [...sheet.columns].reverse() : sheet.columns;

    const columnStyles: Record<number, Record<string, unknown>> = {};
    displayColumns.forEach((col, i) => {
      const min = minWidthFor(col.type);
      if (min) columnStyles[i] = { minCellWidth: min };
    });

    autoTable(doc, {
      head: [displayHeaders.map(track)],
      body: displayBody.map(r => r.map(cell => track(String(cell ?? '')))),
      startY: y + 2,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2.4, lineWidth: 0.1, lineColor: [217, 222, 229], overflow: 'linebreak' },
      headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold', fontSize: 9, minCellHeight: 8 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles,
      margin: { top: margin, left: margin, right: margin, bottom: margin + 4 },
      // jsPDF binds one font per cell — pick the face that owns the script used.
      didParseCell: data => {
        const text = Array.isArray(data.cell.text) ? data.cell.text.join(' ') : String(data.cell.text ?? '');
        const face = fontForText(text, fonts);
        if (face !== 'helvetica') data.cell.styles.font = face;
        if (hasRtl(text)) data.cell.styles.halign = 'right';
        if (totals && data.section === 'body' && data.row.index === displayBody.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [237, 241, 246];
        }
      },
      didDrawPage: () => {
        const footer = `${BRAND.confidentiality}  ·  ${doc.getCurrentPageInfo().pageNumber}`;
        doc.setFont(fontForText(footer, fonts), 'normal');
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text(shapeForPdf(footer), rtl ? pageWidth - margin : margin, pageHeight - 6, { align: alignStart });
      },
    });
  });

  doc.save(`${report.fileName}.pdf`);
  return { rtlFontMissing, empty: false };
}
