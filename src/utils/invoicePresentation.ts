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
  memoNote: string;
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
    memoNote: "عند التحويل البنكي، اكتب رقم الملف في خانة الملاحظات (Memo) حتى نتمكن من مطابقة الدفعة:",
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
    memoNote: "When paying by bank transfer, write this case reference in the transfer memo so we can match your payment:",
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

/** The subset of a frozen invoice item the billing line needs. */
export interface InvoiceItemLike {
  kind?: string | null;
  weeks?: number | null;
  weekly_price?: number | null;
  months?: number | null;
  monthly_price?: number | null;
  billing_period?: string | null;
}

const INVOICE_COPY: Record<"ar" | "en", {
  week: string; weeks: string; weekUnit: string;
  month: string; months: string; monthUnit: string; oneTime: string;
}> = {
  ar: { week: "أسبوع", weeks: "أسابيع", weekUnit: "/أسبوع", month: "شهر", months: "أشهر", monthUnit: "/شهر", oneTime: "دفعة واحدة" },
  en: { week: "week", weeks: "weeks", weekUnit: "/week", month: "month", months: "months", monthUnit: "/month", oneTime: "one-time" },
};

/**
 * The "3 weeks · €245/week" / "6 months · €98/month" line under an invoice item.
 *
 * A one_time premium must NOT render as "1 month · €X/month" — the total is
 * charged once, so labelling it monthly misreads the charge. Mirrors the
 * frontend's insurancePricing rule.
 */
export function formatInvoiceItemBilling(
  item: InvoiceItemLike,
  currency: string,
  isArabic: boolean,
): string {
  const c = INVOICE_COPY[isArabic ? "ar" : "en"];
  if (item.weeks) {
    const unit = item.weeks === 1 ? c.week : c.weeks;
    return `${item.weeks} ${unit}${item.weekly_price != null ? ` · ${formatInvoiceMoney(Number(item.weekly_price), currency)}${c.weekUnit}` : ""}`;
  }
  if (item.months) {
    if (item.billing_period && item.billing_period !== "monthly") {
      return item.monthly_price != null
        ? `${c.oneTime} · ${formatInvoiceMoney(Number(item.monthly_price), currency)}`
        : c.oneTime;
    }
    const unit = item.months === 1 ? c.month : c.months;
    return `${item.months} ${unit}${item.monthly_price != null ? ` · ${formatInvoiceMoney(Number(item.monthly_price), currency)}${c.monthUnit}` : ""}`;
  }
  return "";
}

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