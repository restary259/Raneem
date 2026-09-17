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
import { fitWidths, planColumnGroups } from './tableFit';
import { fontForText, hasRtl, registerPdfFonts, shapeForPdf, type FontRegistration } from '@/utils/pdfFonts';

/** Padding inside every table cell (mm), shared by measuring and drawing. */
const CELL_PADDING = 2.4;

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

export async function exportCorporatePdf(report: CorporateReport): Promise<PdfReportResult> {
  const sheets = report.sheets;
  const hasAnyRow = sheets.some(sheet => sheet.rows.length > 0);
  if (!sheets.length || !hasAnyRow) return { rtlFontMissing: false, empty: true };

  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const rtl = !!report.rtl;
  const locale = report.locale === 'ar' ? 'ar' : report.locale || 'en-US';
  const widest = Math.max(...sheets.map(s => s.columns.length));
  const margin = 10;

  // Measure on a scratch document first: a table that cannot fit the portrait
  // page is printed landscape rather than needlessly split across pages.
  const scratch = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const scratchFonts: FontRegistration = await registerPdfFonts(scratch);
  const measureOn = (target: typeof scratch, faces: FontRegistration) =>
    (text: string, size: number, bold: boolean) => {
      target.setFont(fontForText(text, faces), bold ? 'bold' : 'normal');
      target.setFontSize(size);
      return target.getTextWidth(text);
    };
  const scratchMeasure = measureOn(scratch, scratchFonts);
  const naturalFor = (sheet: CorporateSheet, m: (t: string, s: number, b: boolean) => number) => {
    const probe = sheet.rows.slice(0, 200).map(row =>
      cellsOf(row, sheet.columns).map((value, i) =>
        formatPdfValue(value, sheet.columns[i].type, sheet.columns[i].currency),
      ),
    );
    return sheet.columns.map((col, i) => {
      let w = m(shapeForPdf(String(col.header ?? '')), 9, true);
      for (const row of probe) w = Math.max(w, m(shapeForPdf(String(row[i] ?? '')), 8, false));
      return w + CELL_PADDING * 2 + 1;
    });
  };
  const portraitAvailable = scratch.internal.pageSize.width - margin * 2;
  const needsWide = sheets.some(
    sheet => fitWidths(naturalFor(sheet, scratchMeasure), portraitAvailable).reduce((a, b) => a + b, 0) >
      portraitAvailable + 0.01,
  );

  const doc = new jsPDF({
    orientation: widest > LAYOUT.landscapeThreshold || needsWide ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });
  const fonts: FontRegistration = await registerPdfFonts(doc);

  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const available = pageWidth - margin * 2;
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

  const measure = (text: string, size: number, bold: boolean) => {
    doc.setFont(fontForText(text, fonts), bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    return doc.getTextWidth(text);
  };

  const totalLabel = report.totalLabel ?? 'Total';
  const emptyLabel = report.emptyLabel ?? 'No records';
  const continuedLabel = report.continuedLabel ?? 'part';
  const stampParts = [
    `${BRAND.company}`,
    generatedStamp(locale),
    report.author ? `${report.author}` : null,
  ].filter(Boolean) as string[];

  let firstSection = true;

  sheets.forEach(sheet => {
    const headers = sheet.columns.map(c => c.header);
    const body = sheet.rows.map(row =>
      cellsOf(row, sheet.columns).map((value, i) =>
        formatPdfValue(value, sheet.columns[i].type, sheet.columns[i].currency),
      ),
    );
    const totals = totalsRow(sheet, totalLabel);
    if (totals) body.push(totals);

    // Measure real text so columns are sized by content, then clamp + fit them
    // into the printable area; anything still too wide continues on its own
    // page instead of being drawn off the paper. Grouping is planned in
    // logical column order (so the key column really is the first one) and
    // only the drawing order is mirrored for RTL.
    const probe = body.slice(0, 200);
    const natural = headers.map((header, i) => {
      let w = measure(track(String(header ?? '')), 9, true);
      for (const row of probe) w = Math.max(w, measure(track(String(row[i] ?? '')), 8, false));
      return w + CELL_PADDING * 2 + 1;
    });
    const widths = fitWidths(natural, available);
    const groups = planColumnGroups(widths, available, 0);

    groups.forEach((group, groupIndex) => {
      if (!firstSection) doc.addPage();
      firstSection = false;

      let y = margin + 8;
      const heading =
        groups.length > 1
          ? `${sheet.title || report.title} (${continuedLabel} ${groupIndex + 1}/${groups.length})`
          : sheet.title || report.title;
      write(heading, xStart, y, 15, [30, 58, 95]);
      y += 6;
      const subtitle = [sheet.subtitle, report.subtitle].filter(Boolean).join(' · ');
      if (subtitle) {
        write(subtitle, xStart, y, 9, [107, 114, 128]);
        y += 5;
      }
      write(`${stampParts.join('  ·  ')}  ·  ${sheet.rows.length.toLocaleString(numberLocale)}`, xStart, y, 8, [
        150, 150, 150,
      ]);
      y += 4;

      const drawFooter = () => {
        const footer = `${BRAND.confidentiality}  ·  ${doc.getCurrentPageInfo().pageNumber}`;
        doc.setFont(fontForText(footer, fonts), 'normal');
        doc.setFontSize(7);
        doc.setTextColor(150);
        doc.text(shapeForPdf(footer), rtl ? pageWidth - margin : margin, pageHeight - 6, { align: alignStart });
      };

      // A section with no rows still prints, so the contents page and the
      // document can never disagree about which reports are included.
      if (!sheet.rows.length) {
        write(emptyLabel, xStart, y + 8, 10, [107, 114, 128]);
        drawFooter();
        return;
      }

      const order = rtl ? [...group].reverse() : group;
      const columnStyles: Record<number, Record<string, unknown>> = {};
      order.forEach((sourceIndex, i) => {
        columnStyles[i] = { cellWidth: widths[sourceIndex] };
      });

      autoTable(doc, {
        head: [order.map(i => track(String(headers[i] ?? '')))],
        body: body.map(r => order.map(i => track(String(r[i] ?? '')))),
        startY: y + 2,
        theme: 'grid',
        tableWidth: 'wrap',
        styles: {
          fontSize: 8,
          cellPadding: CELL_PADDING,
          lineWidth: 0.1,
          lineColor: [217, 222, 229],
          overflow: 'linebreak',
        },
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
          if (totals && data.section === 'body' && data.row.index === body.length - 1) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [237, 241, 246];
          }
        },
        didDrawPage: drawFooter,
      });
    });
  });

  doc.save(`${report.fileName}.pdf`);
  return { rtlFontMissing, empty: false };
}
