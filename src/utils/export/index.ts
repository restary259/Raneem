import { buildCorporateWorkbook, CorporateReport, CorporateSheet, ExportColumn } from './corporateSheet';

export * from './theme';
export * from './formats';
export * from './pdfReport';
export type { CorporateReport, CorporateSheet, ExportColumn };
export { buildCorporateWorkbook };


const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/** Generate and download a presentation-ready corporate workbook. */
export async function exportCorporateWorkbook(report: CorporateReport): Promise<void> {
  const wb = await buildCorporateWorkbook(report);
  const buffer = await wb.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], { type: XLSX_MIME }), `${report.fileName}.xlsx`);
}

/** Convenience wrapper for single-table reports. */
export async function exportCorporateSheet(
  options: Omit<CorporateReport, 'sheets'> & Omit<CorporateSheet, 'title' | 'subtitle'>,
): Promise<void> {
  const { fileName, title, subtitle, author, rtl, locale, name, columns, rows } = options;
  return exportCorporateWorkbook({
    fileName,
    title,
    subtitle,
    author,
    rtl,
    locale,
    sheets: [{ name: name || title, title, subtitle, columns, rows }],
  });
}
