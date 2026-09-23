import { selectInvoiceTotals, type DarbInvoiceTotals } from "@/utils/invoiceTotals";

export interface InvoicePresentationMeta {
  invoiceNumber: string;
  caseReference: string | null;
  studentName: string | null;
  issuedAt: string;
}

export interface InvoiceLabels {
  title: string;
  brandLine: string;
  invoiceNumber: string;
  student: string;
  caseReference: string;
  issuedAt: string;
  services: string;
  service: string;
  details: string;
  amount: string;
  subtotal: string;
  discount: string;
  referralDiscount: string;
  total: string;
  paid: string;
  remaining: string;
  fullyPaid: string;
  separationNote: string;
  support: string;
  download: string;
  notFound: string;
}

export interface InvoicePresentation {
  meta: InvoicePresentationMeta;
  totals: DarbInvoiceTotals;
  labels: InvoiceLabels;
  isArabic: boolean;
  fullyPaid: boolean;
}

const LABELS: Record<"ar" | "en", InvoiceLabels> = {
  ar: {
    title: "فاتورة خدمات درب",
    brandLine: "درب للدراسة في ألمانيا",
    invoiceNumber: "رقم الفاتورة",
    student: "الطالب",
    caseReference: "رقم الملف",
    issuedAt: "تاريخ الإصدار",
    services: "خدمات درب (شيكل)",
    service: "الخدمة",
    details: "التفاصيل",
    amount: "المبلغ",
    subtotal: "المجموع الفرعي",
    discount: "الخصم",
    referralDiscount: "خصم الإحالة",
    total: "الإجمالي",
    paid: "المدفوع المؤكد",
    remaining: "الرصيد المتبقي",
    fullyPaid: "هذه الفاتورة مدفوعة بالكامل",
    separationNote: "تكاليف المدرسة ومزوّدي الخدمات في ألمانيا منفصلة عن هذه الفاتورة، وتُدفع مباشرة إلى الجهة المعنية بعد التحقق منها.",
    support: "لأي استفسار بخصوص فاتورتك، يسعدنا تواصلك مع فريق درب",
    download: "تنزيل PDF",
    notFound: "لم يتم العثور على الفاتورة أو انتهت صلاحية الرابط",
  },
  en: {
    title: "DARB Service Invoice",
    brandLine: "Darb Study International",
    invoiceNumber: "Invoice number",
    student: "Student",
    caseReference: "Case reference",
    issuedAt: "Issue date",
    services: "DARB services (ILS)",
    service: "Service",
    details: "Details",
    amount: "Amount",
    subtotal: "Subtotal",
    discount: "Discount",
    referralDiscount: "Referral discount",
    total: "Total",
    paid: "Confirmed payment",
    remaining: "Remaining balance",
    fullyPaid: "This invoice is paid in full",
    separationNote: "German school and provider costs are separate from this invoice and are paid directly to the relevant provider after verification.",
    support: "For questions about this invoice, please contact the DARB team",
    download: "Download PDF",
    notFound: "This invoice could not be found or the link has expired",
  },
};

export const formatInvoiceMoney = (amount: number, currency = "ILS") =>
  `${currency === "EUR" ? "€" : "₪"}${Number(amount || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export function createInvoicePresentation(
  meta: InvoicePresentationMeta,
  rawTotals: unknown,
  isArabic: boolean,
): InvoicePresentation {
  const totals = selectInvoiceTotals(rawTotals);
  return {
    meta,
    totals,
    labels: LABELS[isArabic ? "ar" : "en"],
    isArabic,
    fullyPaid: totals.total_confirmed > 0 && totals.remaining <= 0,
  };
}

export function invoicePdfFileName(invoiceNumber: string) {
  const base = invoiceNumber.trim().replace(/\.pdf$/i, "") || "darb-invoice";
  return `${base}.pdf`;
}