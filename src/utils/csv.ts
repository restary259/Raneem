const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export function buildCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const headers = Array.from(new Set(rows.flatMap(row => Object.keys(row))));
  return [
    headers.map(csvCell).join(','),
    ...rows.map(row => headers.map(header => csvCell(row[header])).join(',')),
  ].join('\r\n');
}

export function downloadCsv(rows: Record<string, unknown>[], fileName: string): boolean {
  const csv = buildCsv(rows);
  if (!csv) return false;
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName.endsWith('.csv') ? fileName : `${fileName}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
  return true;
}