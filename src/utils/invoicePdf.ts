import { exportPDF } from "@/utils/exportUtils";
import type { CaseFinancials } from "@/hooks/useCaseFinancials";

/**
 * Invoice PDF.
 *
 * Reuses the shared export pipeline so the vendored Arabic/Hebrew faces are
 * registered — Helvetica cannot render either script and would silently emit
 * mojibake on a financial document.
 */

interface InvoiceMeta {
  invoiceNumber: string;
  caseReference: string | null;
  studentName: string | null;
  issuedAt: string;
}

const money = (n: number, currency: string) =>
  `${currency === "EUR" ? "€" : "₪"}${Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export async function downloadInvoicePdf(
  meta: InvoiceMeta,
  totals: CaseFinancials,
  isAr: boolean,
) {
  const L = isAr
    ? {
        item: "البند",
        details: "التفاصيل",
        amount: "المبلغ",
        agency: "رسوم الوكالة",
        school: "تكاليف المدرسة (تقديرية)",
        servicesTotal: "إجمالي رسوم الوكالة",
        paid: "المدفوع المؤكد",
        remaining: "الرصيد المتبقي",
        student: "الطالب",
        caseRef: "رقم الملف",
        date: "التاريخ",
        weeks: "أسبوع",
      }
    : {
        item: "Item",
        details: "Details",
        amount: "Amount",
        agency: "Agency fees",
        school: "School costs (estimate)",
        servicesTotal: "Agency fees total",
        paid: "Confirmed payments",
        remaining: "Remaining balance",
        student: "Student",
        caseRef: "Case",
        date: "Date",
        weeks: "weeks",
      };

  const rows: (string | number)[][] = [];

  rows.push([L.agency, "", ""]);
  for (const s of totals.services ?? []) {
    rows.push([
      s.description,
      s.quantity > 1 ? `${s.quantity} × ${money(s.unit_price, s.currency)}` : "",
      money(s.line_total, s.currency),
    ]);
  }

  if ((totals.school_costs ?? []).length) {
    rows.push([L.school, "", ""]);
    for (const c of totals.school_costs) {
      const name = (isAr ? c.name_ar : c.name_en) || c.name_ar || c.name_en || "";
      const detail =
        c.weekly_price && c.weeks
          ? `${money(c.weekly_price, c.currency)} × ${c.weeks} ${L.weeks}`
          : "";
      rows.push([name, detail, money(c.total, c.currency)]);
    }
  }

  const summaryRows: (string | number)[][] = [
    [L.servicesTotal, "", money(totals.service_total, totals.currency)],
    [L.paid, "", money(totals.total_confirmed, totals.currency)],
    [L.remaining, "", money(totals.remaining, totals.currency)],
  ];

  const header = [
    `${L.caseRef}: ${meta.caseReference ?? "-"}`,
    `${L.student}: ${meta.studentName ?? "-"}`,
    `${L.date}: ${new Date(meta.issuedAt).toLocaleDateString("en-US")}`,
  ].join("   |   ");

  return exportPDF({
    headers: [L.item, L.details, L.amount],
    rows: [[header, "", ""], ...rows],
    summaryRows,
    fileName: `${meta.invoiceNumber}.pdf`,
    title: `${meta.invoiceNumber}`,
    rtl: isAr,
    locale: "en-US",
  });
}
