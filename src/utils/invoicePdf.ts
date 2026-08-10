import { exportPDF } from "@/utils/exportUtils";

export interface DarbInvoiceTotals {
  currency: "ILS";
  services: Array<{
    id: string;
    description: string;
    category: string;
    quantity: number;
    unit_price: number;
    discount: number;
    currency: string;
    line_total: number;
  }>;
  service_total: number;
  /** Confirmed agency-service payments only (ILS). */
  total_confirmed?: number;
  /** Outstanding agency-service balance (ILS). */
  remaining?: number;
  payment_type: "agency_service";
}

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

/** PDF representation of the DARB agency-service invoice only. */
export async function downloadInvoicePdf(
  meta: InvoiceMeta,
  totals: DarbInvoiceTotals,
  isAr: boolean,
) {
  const L = isAr
    ? {
        item: "البند",
        details: "التفاصيل",
        amount: "المبلغ",
        agency: "خدمات دارب",
        servicesTotal: "إجمالي خدمات دارب",
        paid: "المدفوع المؤكد",
        remaining: "الرصيد المتبقي",
        student: "الطالب",
        caseRef: "رقم الملف",
        date: "التاريخ",
      }
    : {
        item: "Item",
        details: "Details",
        amount: "Amount",
        agency: "DARB agency services",
        servicesTotal: "DARB services total",
        paid: "Confirmed payments",
        remaining: "Remaining balance",
        student: "Student",
        caseRef: "Case",
        date: "Date",
      };

  const rows: (string | number)[][] = [[L.agency, "", ""]];
  for (const s of totals.services ?? []) {
    rows.push([
      s.description,
      s.quantity > 1 ? `${s.quantity} × ${money(s.unit_price, s.currency)}` : "",
      money(s.line_total, s.currency),
    ]);
  }

  // Germany school costs are excluded from the student invoice. They are paid
  // directly to German providers and verified separately by Admin.

  const summaryRows: (string | number)[][] = [
    [L.servicesTotal, "", money(totals.service_total, totals.currency)],
    [L.paid, "", money(Number(totals.total_confirmed ?? 0), totals.currency)],
    [L.remaining, "", money(Number(totals.remaining ?? Math.max(Number(totals.service_total || 0) - Number(totals.total_confirmed ?? 0), 0)), totals.currency)],
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
