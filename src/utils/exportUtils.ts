import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { registerArabicFont, processArabicText } from './arabicFontLoader';

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

export async function exportPDF({ headers, rows, fileName, title, summaryRows }: ExportOptions) {
  const doc = new jsPDF({ orientation: rows[0]?.length > 6 ? 'landscape' : 'portrait' });

  // Register Arabic font
  await registerArabicFont(doc);

  if (title) {
    doc.setFontSize(16);
    const displayTitle = title.replace(/Darb Study(?! International)/g, 'Darb Study International');
    doc.text(displayTitle, 14, 20);
  }

  const startY = title ? 28 : 14;

  const allRows = [...rows];
  if (summaryRows?.length) {
    allRows.push(headers.map(() => '')); // separator
    allRows.push(...summaryRows);
  }

  autoTable(doc, {
    head: [headers],
    body: allRows.map(r => r.map(c => String(c ?? ''))),
    startY,
    styles: {
      fontSize: 8,
      cellPadding: 3,
      lineWidth: 0.1,
      lineColor: [200, 200, 200],
      font: 'Amiri',
    },
    headStyles: {
      fillColor: [30, 58, 95],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9,
      font: 'Amiri',
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    margin: { top: 10, left: 10, right: 10 },
    didDrawPage: (data) => {
      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(
        `Generated ${new Date().toLocaleDateString()} — Page ${doc.getCurrentPageInfo().pageNumber}`,
        14,
        pageHeight - 8
      );
    },
  });

  doc.save(`${fileName}.pdf`);
}
