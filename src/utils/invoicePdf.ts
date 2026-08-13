import { exportPDF } from "@/utils/exportUtils";
import { selectInvoiceTotals, type DarbInvoiceTotals } from "@/utils/invoiceTotals";

export type { DarbInvoiceTotals } from "@/utils/invoiceTotals";

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
        referralDiscount: "خصم الإحالة",
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
        referralDiscount: "Referral discount",
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

  const normalized = selectInvoiceTotals(totals);

  const summaryRows: (string | number)[][] = [];
  if (normalized.referral_discount > 0) {
    summaryRows.push([L.referralDiscount, "", `−${money(normalized.referral_discount, normalized.currency)}`]);
  }
  summaryRows.push(
    [L.servicesTotal, "", money(normalized.service_total, normalized.currency)],
    [L.paid, "", money(normalized.total_confirmed, normalized.currency)],
    [L.remaining, "", money(normalized.remaining, normalized.currency)],
  );

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
