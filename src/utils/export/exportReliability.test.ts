import { describe, expect, it } from 'vitest';
import { buildCsv } from '@/utils/csv';
import { fontForText, hasRtl, shapeForPdf, ARABIC_FONT, HEBREW_FONT } from '@/utils/pdfFonts';
import { buildCorporateWorkbook } from './corporateSheet';
import { currencyFormat, NUMBER_FORMAT } from './formats';
import { toExportColumns } from '@/components/spreadsheet/exportMapping';

describe('export reliability', () => {
  it('keeps RTL text in logical order and uses Unicode fonts for currency', () => {
    const fonts = { arabic: true, hebrew: true };
    expect(shapeForPdf('سليم 1,000 ₪')).toBe('سليم 1,000 ₪');
    expect(hasRtl('سليم')).toBe(true);
    expect(fontForText('سليم 1,000 ₪', fonts)).toBe(ARABIC_FONT);
    expect(fontForText('1,000 ₪', fonts)).toBe(HEBREW_FONT);
  });

  it('renders explicit numeric and currency zeros', () => {
    expect(NUMBER_FORMAT.split(';')[2]).toBe('0');
    expect(currencyFormat('ILS').split(';')[2]).toContain('₪');
    expect(currencyFormat('EUR').split(';')[2]).toContain('€');
  });

  it('maps only actual status enums to status styling', () => {
    const columns = toExportColumns([
      { key: 'status', label: 'Status', type: 'enum', enumGroup: 'status' },
      { key: 'role', label: 'Role', type: 'enum', enumGroup: 'role' },
      { key: 'method', label: 'Method', type: 'enum', enumGroup: 'method' },
    ]);
    expect(columns.map(column => column.type)).toEqual(['status', 'text', 'text']);
  });

  it('builds RTL workbooks with native values and safe sheet names', async () => {
    const workbook = await buildCorporateWorkbook({
      fileName: 'test',
      title: 'تقرير',
      locale: 'ar',
      rtl: true,
      sheets: [{
        name: 'تقرير:/[]*? طويل جداً جداً جداً جداً',
        columns: [
          { header: 'الاسم', type: 'text' },
          { header: 'المبلغ', type: 'currency', currency: 'ILS', total: 'sum' },
          { header: 'التاريخ', type: 'date' },
        ],
        rows: [['سليم', 0, '2026-08-09'], ['ليان', -1000, '2026-08-10']],
      }],
    });
    const sheet = workbook.worksheets[0];
    expect(sheet.name.length).toBeLessThanOrEqual(31);
    expect(sheet.name).not.toMatch(/[\[\]:*?/\\]/);
    expect(sheet.views[0]?.rightToLeft).toBe(true);
    const amountColumn = sheet.getColumn(2);
    expect(amountColumn.values).toContain(0);
    expect(amountColumn.values).toContain(-1000);
    expect(sheet.getCell(7, 2).numFmt).toBe(currencyFormat('ILS'));
  });

  it('escapes CSV headers, Arabic, quotes, commas and line breaks', () => {
    const csv = buildCsv([{ 'الاسم, الكامل': 'سليم "أ"', note: 'سطر 1\nسطر 2' }]);
    expect(csv).toContain('"الاسم, الكامل"');
    expect(csv).toContain('"سليم ""أ"""');
    expect(csv).toContain('"سطر 1\nسطر 2"');
  });
});