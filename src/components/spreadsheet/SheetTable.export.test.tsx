import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const workbook = vi.fn().mockResolvedValue(undefined);
const pdf = vi.fn().mockResolvedValue({ empty: false, rtlFontMissing: false });
vi.mock('@/utils/export', async (orig) => ({
  ...(await orig<typeof import('@/utils/export')>()),
  exportCorporateWorkbook: (...a: unknown[]) => workbook(...a),
  exportCorporatePdf: (...a: unknown[]) => pdf(...a),
}));
vi.mock('@/utils/export/useExportContext', () => ({
  useExportContext: () => ({ author: 'Tester', locale: 'ar', rtl: true }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, d?: unknown) => (typeof d === 'string' ? d : k) }),
}));

import SheetTable, { type SheetColumn } from './SheetTable';

const columns: SheetColumn[] = [
  { key: 'name', label: 'الاسم' },
  { key: 'city', label: 'City' },
  { key: 'secret', label: 'Hidden col', hidden: true },
];
const rows = [
  { id: 1, name: 'سليم', city: 'Haifa', secret: 'x' },
  { id: 2, name: 'Lina', city: 'Tamra', secret: 'y' },
];

const openMenu = async () => {
  await userEvent.click(screen.getByRole('button', { name: /sheets.export|Export/ }));
  return screen.getByRole('dialog');
};
const lastReport = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls.at(-1)![0];

beforeEach(() => { workbook.mockClear(); pdf.mockClear(); });

describe('SheetTable unified export menu', () => {
  it('renders a single Export control and no separate Excel/PDF buttons', () => {
    render(<SheetTable title="Students" columns={columns} rows={rows} fileName="f" />);
    expect(screen.queryByRole('button', { name: 'sheets.exportExcel' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'sheets.exportPdf' })).toBeNull();
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.getByRole('button', { name: /Export/ })).toBeInTheDocument();
  });

  it('exports visible columns to Excel by default', async () => {
    render(<SheetTable title="Students" columns={columns} rows={rows} fileName="f" />);
    const dlg = await openMenu();
    await userEvent.click(within(dlg).getAllByRole('button', { name: 'Export' }).at(-1)!);
    await waitFor(() => expect(workbook).toHaveBeenCalled());
    const r = lastReport(workbook);
    expect(r.rtl).toBe(true);
    expect(r.sheets[0].columns.map((c: any) => c.header)).toEqual(['الاسم', 'City']);
    expect(r.sheets[0].rows).toEqual([['سليم', 'Haifa'], ['Lina', 'Tamra']]);
  });

  it('exports PDF when chosen', async () => {
    render(<SheetTable title="S" columns={columns} rows={rows} fileName="f" />);
    const dlg = await openMenu();
    await userEvent.click(within(dlg).getByRole('radio', { name: 'PDF (.pdf)' }));
    await userEvent.click(within(dlg).getAllByRole('button', { name: 'Export' }).at(-1)!);
    await waitFor(() => expect(pdf).toHaveBeenCalled());
  });

  it('allows exporting an empty template when there are zero rows', async () => {
    render(<SheetTable title="S" columns={columns} rows={[]} fileName="f" />);
    const dlg = await openMenu();
    expect(within(dlg).getAllByRole('button', { name: 'Export' }).at(-1)).not.toBeDisabled();
    expect(within(dlg).getByText(/empty template/i)).toBeInTheDocument();
  });

  it('exports only rows matching search (parent filters arrive pre-filtered)', async () => {
    render(<SheetTable title="S" columns={columns} rows={rows} fileName="f" externalFiltersActive />);
    fireEvent.change(screen.getByPlaceholderText('sheets.searchPlaceholder'), { target: { value: 'tamra' } });
    const dlg = await openMenu();
    await userEvent.click(within(dlg).getAllByRole('button', { name: 'Export' }).at(-1)!);
    await waitFor(() => expect(workbook).toHaveBeenCalled());
    expect(lastReport(workbook).sheets[0].rows).toEqual([['Lina', 'Tamra']]);
  });
});

describe('SheetTable menu scopes', () => {
  const full = vi.fn().mockResolvedValue(undefined);
  const packet = vi.fn().mockResolvedValue(undefined);
  const scopes = [
    { value: 'full', label: 'Full report', help: 'All spreadsheet tabs using current filters', run: full },
    { value: 'schoolPacket', label: 'School packet', requiresRows: true, run: packet },
  ];
  beforeEach(() => { full.mockClear(); packet.mockClear(); });

  it('renders radio groups and offers the extra scopes', async () => {
    render(<SheetTable title="S" columns={columns} rows={rows} fileName="f" extraExportScopes={scopes} />);
    const dlg = await openMenu();
    expect(within(dlg).getAllByRole('radiogroup').length).toBe(3);
    expect(within(dlg).getByRole('radio', { name: 'Excel (.xlsx)' })).toHaveAttribute('aria-checked', 'true');
    expect(within(dlg).getByText('All spreadsheet tabs using current filters')).toBeInTheDocument();
  });

  it('current view PDF with custom columns including a hidden one', async () => {
    render(<SheetTable title="S" columns={columns} rows={rows} fileName="f" extraExportScopes={scopes} />);
    const dlg = await openMenu();
    await userEvent.click(within(dlg).getByRole('radio', { name: 'PDF (.pdf)' }));
    await userEvent.click(within(dlg).getByRole('radio', { name: 'Choose columns' }));
    await userEvent.click(within(dlg).getByRole('checkbox', { name: 'City' }));
    await userEvent.click(within(dlg).getByRole('checkbox', { name: 'Hidden col' }));
    await userEvent.click(within(dlg).getAllByRole('button', { name: 'Export' }).at(-1)!);
    await waitFor(() => expect(pdf).toHaveBeenCalled());
    expect(lastReport(pdf).sheets[0].columns.map((c: any) => c.header)).toEqual(['الاسم', 'Hidden col']);
  });

  it('zero selected columns disables export', async () => {
    render(<SheetTable title="S" columns={columns} rows={rows} fileName="f" />);
    const dlg = await openMenu();
    await userEvent.click(within(dlg).getByRole('radio', { name: 'Choose columns' }));
    await userEvent.click(within(dlg).getByRole('checkbox', { name: 'الاسم' }));
    await userEvent.click(within(dlg).getByRole('checkbox', { name: 'City' }));
    expect(within(dlg).getByRole('alert')).toBeInTheDocument();
    expect(within(dlg).getAllByRole('button', { name: 'Export' }).at(-1)).toBeDisabled();
  });

  it('full report and school packet delegate to the workspace; selection resets on reopen', async () => {
    render(<SheetTable title="S" columns={columns} rows={rows} fileName="f" extraExportScopes={scopes} />);
    let dlg = await openMenu();
    await userEvent.click(within(dlg).getByRole('radio', { name: /Full report/ }));
    await userEvent.click(within(dlg).getByRole('radio', { name: 'PDF (.pdf)' }));
    await userEvent.click(within(dlg).getAllByRole('button', { name: 'Export' }).at(-1)!);
    await waitFor(() => expect(full).toHaveBeenCalledWith('pdf'));
    dlg = await openMenu();
    expect(within(dlg).getByRole('radio', { name: /Current view/ })).toHaveAttribute('aria-checked', 'true');
    expect(within(dlg).getByRole('radio', { name: 'Excel (.xlsx)' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(within(dlg).getByRole('radio', { name: /School packet/ }));
    await userEvent.click(within(dlg).getAllByRole('button', { name: 'Export' }).at(-1)!);
    await waitFor(() => expect(packet).toHaveBeenCalledWith('xlsx'));
  });

  it('zero rows: current view exports a template, only row-dependent scopes are disabled', async () => {
    render(<SheetTable title="S" columns={columns} rows={[]} fileName="f" extraExportScopes={scopes} />);
    const dlg = await openMenu();
    const submit = () => within(dlg).getAllByRole('button', { name: 'Export' }).at(-1)!;
    expect(submit()).not.toBeDisabled();
    await userEvent.click(within(dlg).getByRole('radio', { name: /School packet/ }));
    expect(submit()).toBeDisabled();
    await userEvent.click(within(dlg).getByRole('radio', { name: /Full report/ }));
    expect(submit()).not.toBeDisabled();
  });

  it('clamps the popover to the viewport height and keeps the submit docked', async () => {
    render(<SheetTable title="S" columns={columns} rows={rows} fileName="f" />);
    const dlg = await openMenu();
    expect(dlg.className).toContain('w-[min(340px,calc(100vw-2rem))]');
    expect(dlg.className).toContain('--radix-popover-content-available-height');
    expect(dlg.className).toContain('max-h-[min(');
    expect(dlg.className).toContain('flex-col');
    const scroll = dlg.querySelector('.overflow-y-auto');
    expect(scroll).not.toBeNull();
    const submit = within(dlg).getAllByRole('button', { name: 'Export' }).at(-1)!;
    expect(submit.closest('.overflow-y-auto')).toBeNull();
    expect(scroll!.contains(submit)).toBe(false);
  });
});
