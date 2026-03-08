import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RefreshCw, Download, Settings2, FileText, Filter } from "lucide-react";
import { format } from "date-fns";
// ✅ FIX: Import the generateIntakeMonths utility instead of using a hardcoded 2025 start date
import { generateIntakeMonths } from "@/utils/intakeMonths";

interface StudentRow {
  id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  city: string | null;
  program_name: string | null;
  school_name: string | null;
  accommodation_name: string | null;
  insurance_name: string | null;
  intake_month: string | null;
  course_start: string | null;
  course_end: string | null;
  program_price: number;
  accommodation_price: number;
  insurance_price: number;
  total: number;
  status: string;
}

interface Column {
  key: keyof StudentRow;
  label: string;
  selected: boolean;
}

const ALL_COLUMNS_KEYS = [
  "full_name", "email", "phone_number", "city", "program_name", "school_name",
  "accommodation_name", "insurance_name", "intake_month", "course_start",
  "course_end", "program_price", "accommodation_price", "insurance_price",
  "total", "status",
] as const;

const DEFAULT_SELECTED = new Set([
  "full_name","email","phone_number","city","program_name","school_name",
  "accommodation_name","intake_month","course_start","course_end",
]);

// ✅ FIX: Generate month options starting from the CURRENT month (not hardcoded 2025-01-01)
// generateIntakeMonths() uses Asia/Jerusalem timezone automatically
const MONTH_OPTIONS = generateIntakeMonths(24);

export default function AdminSpreadsheetPage() {
  const { toast } = useToast();
  const { t } = useTranslation("dashboard");
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState("all");
  const [showColConfig, setShowColConfig] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(DEFAULT_SELECTED);
  const tableRef = useRef<HTMLTableElement>(null);

  const columns = useMemo(() => [
    { key: "full_name" as keyof StudentRow, label: t("admin.spreadsheet.col.name") },
    { key: "email" as keyof StudentRow, label: t("admin.spreadsheet.col.email") },
    { key: "phone_number" as keyof StudentRow, label: t("admin.spreadsheet.col.phone") },
    { key: "city" as keyof StudentRow, label: t("admin.spreadsheet.col.city") },
    { key: "program_name" as keyof StudentRow, label: t("admin.spreadsheet.col.program") },
    { key: "school_name" as keyof StudentRow, label: t("admin.spreadsheet.col.school") },
    { key: "accommodation_name" as keyof StudentRow, label: t("admin.spreadsheet.col.accommodation") },
    { key: "insurance_name" as keyof StudentRow, label: t("admin.spreadsheet.col.insurance") },
    { key: "intake_month" as keyof StudentRow, label: t("admin.spreadsheet.col.intakeMonth") },
    { key: "course_start" as keyof StudentRow, label: t("admin.spreadsheet.col.courseStart") },
    { key: "course_end" as keyof StudentRow, label: t("admin.spreadsheet.col.courseEnd") },
    { key: "program_price" as keyof StudentRow, label: t("admin.spreadsheet.col.programCost") },
    { key: "accommodation_price" as keyof StudentRow, label: t("admin.spreadsheet.col.accommodationCost") },
    { key: "insurance_price" as keyof StudentRow, label: t("admin.spreadsheet.col.insuranceCost") },
    { key: "total" as keyof StudentRow, label: t("admin.spreadsheet.col.totalCost") },
    { key: "status" as keyof StudentRow, label: t("admin.spreadsheet.col.status") },
  ], [t]);

  const activeColumns = useMemo(() => columns.filter(c => selectedKeys.has(c.key)), [columns, selectedKeys]);
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: subs, error } = await supabase.from("case_submissions").select(`
          id, program_start_date, program_end_date, extra_data,
          program_price, accommodation_price, insurance_price,
          case:cases(id, full_name, status),
          program:programs(name_en),
          accommodation:accommodations(name_en),
          insurance:insurances(name)
        `);
      if (error) throw error;

      const mapped: StudentRow[] = (subs || []).map((s: any) => {
        const extra = s.extra_data ?? {};
        const intakeMonth = extra.start_month ?? (s.program_start_date ? s.program_start_date.substring(0, 7) : null);

        // ✅ FIX: Resolve school name from extra_data if school field is not joined
        const schoolName = extra.school_name ?? null;

        const total = (s.program_price ?? 0) + (s.accommodation_price ?? 0) + (s.insurance_price ?? 0);

        // ✅ FIX: Construct full_name from parts if case name is unavailable
        const full_name =
          (s.case?.full_name ??
            [extra.first_name, extra.middle_name, extra.last_name].filter(Boolean).join(" ").trim()) ||
          "—";

        return {
          id: s.case?.id ?? s.id,
          full_name,
          email: extra.student_email ?? "—",
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
          status: s.case?.status ?? "—",
        };
      });

      setRows(mapped);
    } catch (err: any) {
      toast({ variant: "destructive", description: err.message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredRows = filterMonth !== "all" ? rows.filter((r) => r.intake_month?.startsWith(filterMonth)) : rows;

  const toggleColumn = (key: keyof StudentRow) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const exportPDF = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const tableHTML = `
      <!DOCTYPE html><html><head>
      <title>DARB Student Spreadsheet${filterMonth !== "all" ? ` — ${filterMonth}` : ""}</title>
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
      <p class="subtitle">Generated ${format(new Date(), "MMMM d, yyyy")}${
        filterMonth !== "all" ? ` · Intake: ${filterMonth}` : ""
      } · ${filteredRows.length} students</p>
      <table>
        <thead><tr>${activeColumns.map((c) => `<th>${c.label}</th>`).join("")}</tr></thead>
        <tbody>
          ${filteredRows
            .map(
              (row) =>
                `<tr>${activeColumns
                  .map((c) => {
                    const val = row[c.key];
                    const isPrice = ["program_price", "accommodation_price", "insurance_price", "total"].includes(
                      c.key as string,
                    );
                    return `<td${c.key === "total" ? ' class="total"' : ""}>${
                      isPrice ? `€${Number(val || 0).toLocaleString()}` : (val ?? "—")
                    }</td>`;
                  })
                  .join("")}</tr>`,
            )
            .join("")}
        </tbody>
      </table>
      </body></html>`;
    printWindow.document.write(tableHTML);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">{t("admin.spreadsheet.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("admin.spreadsheet.subtitle")}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowColConfig(true)}>
            <Settings2 className="h-4 w-4 me-1" />
            {t("admin.spreadsheet.columns")}
          </Button>
          <Button size="sm" onClick={exportPDF}>
            <Download className="h-4 w-4 me-1" />
            {t("admin.spreadsheet.exportPDF")}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap p-3 rounded-lg bg-muted/40 border border-border">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex items-center gap-2">
          <Label className="text-sm whitespace-nowrap">{t("admin.spreadsheet.intakeMonth")}</Label>
          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="w-48 h-8 text-sm">
              <SelectValue placeholder={t("admin.spreadsheet.allMonths")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("admin.spreadsheet.allMonths")}</SelectItem>
              {/* ✅ FIX: MONTH_OPTIONS now starts from current month, not 2025-01 */}
              {MONTH_OPTIONS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filterMonth !== "all" && (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setFilterMonth("all")}>
              {t("admin.spreadsheet.clear")}
            </Button>
          )}
        </div>
        <span className="text-xs text-muted-foreground ms-auto">{filteredRows.length} {t("admin.spreadsheet.studentsCount")}</span>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-auto">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground text-sm">{t("admin.spreadsheet.loading")}</div>
        ) : filteredRows.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              {t("admin.spreadsheet.noStudents")}
              {filterMonth !== "all" ? ` ${t("admin.spreadsheet.noStudentsForMonth", { month: filterMonth })}` : ""}
            </p>
          </div>
        ) : (
          <table ref={tableRef} className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                {activeColumns.map((col) => (
                  <th
                    key={col.key}
                    className="text-left text-xs font-semibold text-muted-foreground px-3 py-2.5 whitespace-nowrap"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, i) => (
                <tr
                  key={row.id}
                  className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${
                    i % 2 === 0 ? "" : "bg-muted/10"
                  }`}
                >
                  {activeColumns.map((col) => {
                    const val = row[col.key];
                    const isPrice = ["program_price", "accommodation_price", "insurance_price", "total"].includes(
                      col.key as string,
                    );
                    return (
                      <td
                        key={col.key}
                        className={`px-3 py-2.5 whitespace-nowrap ${
                          col.key === "total" ? "font-semibold text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {isPrice ? (
                          <span className="text-emerald-700 font-medium">€{Number(val || 0).toLocaleString()}</span>
                        ) : col.key === "status" ? (
                          <Badge variant="secondary" className="text-xs">
                            {String(val ?? "").replace(/_/g, " ")}
                          </Badge>
                        ) : (
                          String(val ?? "—")
                        )}
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
      <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              {t("admin.spreadsheet.configColumns")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {columns.map((col) => (
              <div
                key={col.key}
                className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-muted/50 transition-colors"
              >
                <Checkbox id={col.key} checked={selectedKeys.has(col.key)} onCheckedChange={() => toggleColumn(col.key)} />
                <Label htmlFor={col.key} className="text-sm cursor-pointer flex-1">
                  {col.label}
                </Label>
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setSelectedKeys(new Set(columns.map(c => c.key)))}
            >
              {t("admin.spreadsheet.selectAll")}
            </Button>
            <Button size="sm" className="flex-1" onClick={() => setShowColConfig(false)}>
              {t("admin.spreadsheet.done")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
