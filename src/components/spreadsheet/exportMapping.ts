import { ExportColumn } from '@/utils/export';
import { SheetColumn, ValueTranslator } from './SheetTable';

/** Map a Spreadsheet Hub column definition onto the corporate export engine. */
export function toExportColumns(columns: SheetColumn[]): ExportColumn[] {
  return columns.map(c => ({
    header: c.label,
    key: c.key,
    type:
      c.type === 'enum' && (c.enumGroup ?? 'status') === 'status'
        ? ('status' as const)
        : c.type === 'currency'
          ? ('currency' as const)
          : c.type === 'number'
            ? ('number' as const)
            : c.type === 'percent'
              ? ('percent' as const)
              : c.type === 'date'
                ? ('date' as const)
                : ('text' as const),
    // School-side costs are EUR and agency fees are ILS — never force one symbol.
    currency: c.type === 'currency' ? (c.currency === 'EUR' ? ('EUR' as const) : ('ILS' as const)) : undefined,
    total: c.total ? ('sum' as const) : undefined,
    dataBar: c.total && c.type === 'currency' ? true : undefined,
  }));
}


/**
 * Rows keep their raw values so Excel can format numbers and dates natively;
 * enum columns are swapped for their translated label.
 */
export function toExportRows(
  rows: Record<string, unknown>[],
  columns: SheetColumn[],
  translate: ValueTranslator,
): unknown[][] {
  return rows.map(r =>
    columns.map(c => (c.type === 'enum' ? translate(c.enumGroup ?? 'status', r[c.key]) : r[c.key])),
  );
}
