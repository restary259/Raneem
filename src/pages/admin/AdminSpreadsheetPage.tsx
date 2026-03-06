import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RefreshCw, Download, Settings2, FileText, Filter } from 'lucide-react';
import { format, addMonths } from 'date-fns';

interface StudentRow {
  id: string; full_name: string; email: string; phone_number: string | null;
  city: string | null; program_name: string | null; school_name: string | null;
  accommodation_name: string | null; insurance_name: string | null;
  intake_month: string | null; course_start: string | null; course_end: string | null;
  program_price: number; accommodation_price: number; insurance_price: number;
  total: number; status: string;
}

interface Column { key: keyof StudentRow; label: string; selected: boolean; }

const ALL_COLUMNS: Column[] = [
  { key: 'full_name', label: 'Name', selected: true },
  { key: 'email', label: 'Email', selected: true },
  { key: 'phone_number', label: 'Phone', selected: true },
  { key: 'city', label: 'City', selected: true },
  { key: 'program_name', label: 'Program', selected: true },
  { key: 'school_name', label: 'School', selected: true },
  { key: 'accommodation_name', label: 'Accommodation', selected: true },
  { key: 'insurance_name', label: 'Insurance', selected: false },
  { key: 'intake_month', label: 'Intake Month', selected: true },
  { key: 'course_start', label: 'Course Start', selected: true },
  { key: 'course_end', label: 'Course End', selected: true },
  { key: 'program_price', label: 'Program Cost', selected: false },
  { key: 'accommodation_price', label: 'Accommodation Cost', selected: false },
  { key: 'insurance_price', label: 'Insurance Cost', selected: false },
  { key: 'total', label: 'Total Cost', selected: false },
  { key: 'status', label: 'Status', selected: false },
];

// Generate month options
const MONTH_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const d = addMonths(new Date(2025, 0, 1), i);
  return { value: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy') };
});

export default function AdminSpreadsheetPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [columns, setColumns] = useState<Column[]>(ALL_COLUMNS);
  const [filterMonth, setFilterMonth] = useState('');
  const [showColConfig, setShowColConfig] = useState(false);
  const tableRef = useRef<HTMLTableElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch case_submissions joined with related data
      const { data: subs, error } = await supabase
        .from('case_submissions')
        .select(`
          id, program_start_date, program_end_date, extra_data,
          program_price, accommodation_price, insurance_price,
          case:cases(id, full_name, status),
          program:programs(name_en),
          accommodation:accommodations(name_en),
          insurance:insurances(name)
        `);
      if (error) throw error;

      // Also get student profiles for email/phone
      const rows: StudentRow[] = (subs || []).map((s: any) => {
        const extra = s.extra_data ?? {};
        const intakeMonth = extra.start_month ?? (s.program_start_date ? s.program_start_date.substring(0, 7) : null);
        const schoolName = extra.school_name ?? null;
        const total = (s.program_price ?? 0) + (s.accommodation_price ?? 0) + (s.insurance_price ?? 0);
        return {
          id: s.case?.id ?? s.id,
          full_name: s.case?.full_name ?? extra.first_name ? `${extra.first_name} ${extra.middle_name ?? ''} ${extra.last_name ?? ''}`.trim() : '—',
          email: extra.student_email ?? '—',
          phone_number: extra.student_phone ?? null,
          city: extra.city ?? null,
          program_name: s.program?.name_en ?? null,
          school_name: schoolName,
          accommodation_name: s.accommodation?.name_en ?? null,
          insurance_name: s.insurance?.name ?? null,
          intake_month: intakeMonth,
          course_start: s.program_start_date,
          course_end: s.program_end_date,
          program_price: s.program_price ?? 0,
          accommodation_price: s.accommodation_price ?? 0,
          insurance_price: s.insurance_price ?? 0,
          total,
          status: s.case?.status ?? '—',
        };
      });
      setRows(rows);
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const activeColumns = columns.filter(c => c.selected);
  const filteredRows = filterMonth
    ? rows.filter(r => r.intake_month?.startsWith(filterMonth))
    : rows;

  const toggleColumn = (key: keyof StudentRow) => {
    setColumns(prev => prev.map(c => c.key === key ? { ...c, selected: !c.selected } : c));
  };

  const exportPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const tableHTML = `
      <!DOCTYPE html><html><head>
      <title>DARB Student Spreadsheet${filterMonth ? ` — ${filterMonth}` : ''}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 11px; margin: 20px; color: #111; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        p.subtitle { color: #555; margin-bottom: 16px; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #1a1a2e; color: white; padding: 8px 10px; text-align: left; font-size: 11px; }
        td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
        tr:nth-child(even) td { background: #f9fafb; }
        .total { font-weight: bold; }
        @media print { body { margin: 10px; } }
      </style></head><body>
      <h1>DARB — Student Applications</h1>
      <p class="subtitle">Generated ${format(new Date(), 'MMMM d, yyyy')}${filterMonth ? ` · Intake: ${filterMonth}` : ''} · ${filteredRows.length} students</p>
      <table>
        <thead><tr>${activeColumns.map(c => `<th>${c.label}</th>`).join('')}</tr></thead>
        <tbody>
          ${filteredRows.map(row => `<tr>${activeColumns.map(c => {
            const val = row[c.key];
            const isPrice = ['program_price', 'accommodation_price', 'insurance_price', 'total'].includes(c.key as string);
            return `<td${c.key === 'total' ? ' class="total"' : ''}>${isPrice ? `€${Number(val || 0).toLocaleString()}` : val ?? '—'}</td>`;
          }).join('')}</tr>`).join('')}
        </tbody>
      </table>
      </body></html>`;
    printWindow.document.write(tableHTML);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-full">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Student Spreadsheet</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Configurable view of all student applications</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setShowColConfig(true)}><Settings2 className="h-4 w-4 me-1" />Columns</Button>
          <Button size="sm" onClick={exportPDF}><Download className="h-4 w-4 me-1" />Export PDF</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap p-3 rounded-lg bg-muted/40 border border-border">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">Intake Month:</Label>
          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="w-48 h-8 text-sm">
              <SelectValue placeholder="All months" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All months</SelectItem>
              {MONTH_OPTIONS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {filterMonth && <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setFilterMonth('')}>Clear</Button>}
        </div>
        <span className="text-xs text-muted-foreground ms-auto">{filteredRows.length} students</span>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-auto">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground text-sm">Loading…</div>
        ) : filteredRows.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No students found{filterMonth ? ` for intake month ${filterMonth}` : ''}</p>
          </div>
        ) : (
          <table ref={tableRef} className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                {activeColumns.map(col => (
                  <th key={col.key} className="text-left text-xs font-semibold text-muted-foreground px-3 py-2.5 whitespace-nowrap">{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, i) => (
                <tr key={row.id} className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                  {activeColumns.map(col => {
                    const val = row[col.key];
                    const isPrice = ['program_price', 'accommodation_price', 'insurance_price', 'total'].includes(col.key as string);
                    return (
                      <td key={col.key} className={`px-3 py-2.5 whitespace-nowrap ${col.key === 'total' ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                        {isPrice
                          ? <span className="text-emerald-700 font-medium">€{Number(val || 0).toLocaleString()}</span>
                          : col.key === 'status'
                            ? <Badge variant="secondary" className="text-xs">{String(val ?? '').replace(/_/g, ' ')}</Badge>
                            : String(val ?? '—')
                        }
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Column configurator */}
      <Dialog open={showColConfig} onOpenChange={setShowColConfig}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Settings2 className="h-4 w-4" />Configure Columns</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {columns.map(col => (
              <div key={col.key} className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-muted/50 transition-colors">
                <Checkbox
                  id={col.key}
                  checked={col.selected}
                  onCheckedChange={() => toggleColumn(col.key)}
                />
                <Label htmlFor={col.key} className="text-sm cursor-pointer flex-1">{col.label}</Label>
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => setColumns(ALL_COLUMNS.map(c => ({ ...c, selected: true })))}>Select All</Button>
            <Button size="sm" className="flex-1" onClick={() => setShowColConfig(false)}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
