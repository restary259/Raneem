import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ExportOptions {
  headers: string[];
  rows: (string | number)[][];
  fileName: string;
  title?: string;
  /** Optional summary rows at the bottom (e.g. totals) */
  summaryRows?: (string | number)[][];
}

export function exportXLSX({ headers, rows, fileName, title, summaryRows }: ExportOptions) {
  const wb = XLSX.utils.book_new();
  const data: (string | number)[][] = [];

  if (title) {
    data.push([title]);
    data.push([]); // blank row
  }

  data.push(headers);
  data.push(...rows);

  if (summaryRows?.length) {
    data.push([]); // blank separator
    data.push(...summaryRows);
  }

  const ws = XLSX.utils.aoa_to_sheet(data);

  // Column widths based on content
  const colWidths = headers.map((h, i) => {
    const maxLen = Math.max(
      h.length,
      ...rows.map(r => String(r[i] ?? '').length),
      ...(summaryRows || []).map(r => String(r[i] ?? '').length)
    );
    return { wch: Math.min(maxLen + 4, 40) };
  });
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}

export function exportPDF({ headers, rows, fileName, title, summaryRows }: ExportOptions) {
  const doc = new jsPDF({ orientation: rows[0]?.length > 6 ? 'landscape' : 'portrait' });

  if (title) {
    doc.setFontSize(16);
    doc.text(title, 14, 20);
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
    didDrawPage: (data) => {
      // Footer with date
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
