import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  registerPdfFonts,
  loadTextShaper,
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
}

export async function exportXLSX({ headers, rows, fileName, title, summaryRows }: ExportOptions) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Data');

  if (title) {
    ws.addRow([title]);
    ws.addRow([]);
  }

  const headerRow = ws.addRow(headers);
  headerRow.font = { bold: true };

  rows.forEach(r => ws.addRow(r));

  if (summaryRows?.length) {
    ws.addRow([]);
    summaryRows.forEach(r => ws.addRow(r));
  }

  // Auto-size columns
  ws.columns = headers.map((h, i) => {
    const maxLen = Math.max(
      h.length,
      ...rows.map(r => String(r[i] ?? '').length),
      ...(summaryRows || []).map(r => String(r[i] ?? '').length)
    );
    return { width: Math.min(maxLen + 4, 40) };
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export interface PdfExportResult {
  /** True when RTL text was present but no font could render it. */
  rtlFontMissing: boolean;
}

export async function exportPDF({
  headers,
  rows,
  fileName,
  title,
  summaryRows,
}: ExportOptions): Promise<PdfExportResult> {
  const doc = new jsPDF({ orientation: rows[0]?.length > 6 ? 'landscape' : 'portrait' });

  // Bundled Arabic/Hebrew faces — Helvetica cannot render either script and
  // silently produces mojibake, so we track what actually registered.
  const fonts = await registerPdfFonts(doc);
  await loadTextShaper();

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

  if (title) {
    const displayTitle = title.replace(/Darb Study(?! International)/g, 'Darb Study International');
    doc.setFont(fontForText(displayTitle, fonts), 'normal');
    doc.setFontSize(16);
    doc.text(draw(displayTitle), 14, 20);
  }

  const startY = title ? 28 : 14;

  autoTable(doc, {
    head: [headers.map(draw)],
    body: allRows.map(r => r.map(draw)),
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
      if (hasRtl(text)) {
        data.cell.styles.font = fontForText(text, fonts);
        data.cell.styles.halign = 'right';
      }
    },
    didDrawPage: () => {
      const pageHeight = doc.internal.pageSize.height;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(
        `Generated ${new Date().toLocaleDateString('en-US')} — Page ${doc.getCurrentPageInfo().pageNumber}`,
        14,
        pageHeight - 8
      );
    },
  });

  doc.save(`${fileName}.pdf`);
  return { rtlFontMissing };
}


export interface WorkbookSheet {
  name: string;
  headers: string[];
  rows: (string | number)[][];
}

/** Export several sheets into one .xlsx workbook. */
export async function exportWorkbook(sheets: WorkbookSheet[], fileName: string) {
  const wb = new ExcelJS.Workbook();

  sheets.forEach(sheet => {
    // Excel sheet names: max 31 chars, no []:*?/\
    const safeName = sheet.name.replace(/[\[\]:*?/\\]/g, ' ').slice(0, 31) || 'Sheet';
    const ws = wb.addWorksheet(safeName);
    const headerRow = ws.addRow(sheet.headers);
    headerRow.font = { bold: true };
    sheet.rows.forEach(r => ws.addRow(r));
    ws.columns = sheet.headers.map((h, i) => {
      const maxLen = Math.max(h.length, ...sheet.rows.map(r => String(r[i] ?? '').length));
      return { width: Math.min(maxLen + 4, 40) };
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
