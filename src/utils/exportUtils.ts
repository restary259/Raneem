import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LAYOUT } from './export/theme';
import {
  registerPdfFonts,
  shapeForPdf,
  fontForText,
  hasRtl,
} from './pdfFonts';


interface ExportOptions {
  headers: string[];
  rows: (string | number)[][];
  fileName: string;
  title?: string;
  /** Optional summary rows at the bottom (e.g. totals) */
  summaryRows?: (string | number)[][];
  locale?: string;
  rtl?: boolean;
}

export interface PdfExportResult {
  /** True when RTL text was present but no font could render it. */
  rtlFontMissing: boolean;
}

export function preparePdfTableData(
  headers: string[],
  rows: (string | number)[][],
  rtl: boolean,
) {
  return rtl
    ? { headers: [...headers].reverse(), rows: rows.map(row => [...row].reverse()) }
    : { headers, rows };
}

export async function exportPDF({
  headers,
  rows,
  fileName,
  title,
  summaryRows,
  locale = 'en-US',
  rtl = false,
}: ExportOptions): Promise<PdfExportResult> {
  const doc = new jsPDF({ orientation: headers.length > LAYOUT.landscapeThreshold ? 'landscape' : 'portrait' });

  // Bundled Arabic/Hebrew faces — Helvetica cannot render either script and
  // silently produces mojibake, so we track what actually registered.
  const fonts = await registerPdfFonts(doc);
  const allRows = [...rows];
  if (summaryRows?.length) {
    allRows.push(headers.map(() => '')); // separator
    allRows.push(...summaryRows);
  }

  const cells = [...headers, ...allRows.flat()].map(c => String(c ?? ''));
  const rtlFontMissing = cells.some(
    c => hasRtl(c) && fontForText(c, fonts, '') === '',
  );

  const draw = (value: unknown) => shapeForPdf(String(value ?? ''));
  const displayed = preparePdfTableData(headers, allRows, rtl);

  if (title) {
    const displayTitle = title;
    doc.setFont(fontForText(displayTitle, fonts), 'normal');
    doc.setFontSize(16);
    doc.text(draw(displayTitle), rtl ? doc.internal.pageSize.width - 14 : 14, 20, {
      align: rtl ? 'right' : 'left',
    });
  }

  const startY = title ? 28 : 14;

  autoTable(doc, {
    head: [displayed.headers.map(draw)],
    body: displayed.rows.map(r => r.map(draw)),
    startY,
    styles: {
      fontSize: 8,
      cellPadding: 3,
      lineWidth: 0.1,
      lineColor: [200, 200, 200],
    },
    headStyles: {
      fillColor: [30, 58, 95],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9,
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    margin: { top: 10, left: 10, right: 10 },
    // jsPDF has one font per cell — pick the face that owns the script used.
    didParseCell: data => {
      const text = Array.isArray(data.cell.text) ? data.cell.text.join(' ') : String(data.cell.text ?? '');
      const selectedFont = fontForText(text, fonts);
      if (selectedFont !== 'helvetica') data.cell.styles.font = selectedFont;
      if (hasRtl(text)) {
        data.cell.styles.halign = 'right';
      }
    },
    didDrawPage: () => {
      const pageHeight = doc.internal.pageSize.height;
      const footer = `${new Date().toLocaleDateString(locale === 'ar' ? 'en-US' : locale)} — ${doc.getCurrentPageInfo().pageNumber}`;
      doc.setFont(fontForText(footer, fonts), 'normal');
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(
        footer,
        14,
        pageHeight - 8
      );
    },
  });

  doc.save(`${fileName}.pdf`);
  return { rtlFontMissing };
}
