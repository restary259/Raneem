import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "@/lib/router-compat";
import { useTranslation } from "react-i18next";
import { CheckCircle2, CreditCard, Download, ExternalLink, Landmark, Loader2, Phone, ReceiptText, WalletCards } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import darbLogoAsset from "@/assets/darb-logo.png.asset.json";
import { downloadInvoicePdf } from "@/utils/invoicePdf";
import { downloadRegistrationInvoicePdf } from "@/utils/registrationInvoicePdf";
import { createInvoicePresentation, formatInvoiceItemBilling, formatInvoiceMoney } from "@/utils/invoicePresentation";

interface PublicInvoice {
  invoice_number: string;
  case_reference: string | null;
  student_name: string | null;
  issued_at: string;
  totals: unknown;
}

interface RegistrationInvoice {
  id: string;
  invoice_number: string;
  public_token: string;
  case_id: string;
  case_reference: string | null;
  student_name: string;
  student_email: string;
  referrer_name: string | null;
  referral_type: "friend" | "family" | null;
  currency: string;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  items: Array<Record<string, any>>;
  locale: "en" | "ar" | "he";
  status: "issued" | "paid" | "cancelled";
  payment_status: "pending" | "submitted" | "paid" | "failed" | "refunded";
  due_at: string | null;
  issued_at: string;
  payments: Array<Record<string, any>>;
  bank_details: { bank_name: string; account_holder: string; iban: string; bic: string };
}

export default function InvoicePage() {
  const { token } = useParams<{ token: string }>();
  const { i18n } = useTranslation();
  const [invoice, setInvoice] = useState<PublicInvoice | null>(null);
  const [registrationInvoice, setRegistrationInvoice] = useState<RegistrationInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [cardLoading, setCardLoading] = useState(false);
  const [bankLoading, setBankLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!token) return;

      const { data: registrationData, error: registrationError } = await (supabase as any).rpc("get_registration_invoice_by_token", {
        p_token: token,
      });
      if (registrationError) console.error("[invoice] registration lookup failed", registrationError.message);

      if (active && registrationData) {
        setRegistrationInvoice(registrationData as RegistrationInvoice);
        setInvoice(null);
        return;
      }

      const { data, error } = await (supabase as any).rpc("get_invoice_by_token", { p_token: token });
      if (error) console.error("[invoice] lookup failed", error.message);
      if (!active) return;
      // A failed read must not be shown as "not found".
      if (!data && (error || registrationError)) setLoadFailed(true);
      setInvoice((data as PublicInvoice) ?? null);
    })().finally(() => active && setLoading(false));

    return () => { active = false; };
  }, [token]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-editorial-paper">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (registrationInvoice) {
    return (
      <RegistrationInvoiceView
        invoice={registrationInvoice}
        token={token ?? ""}
        language={i18n.language}
        downloading={downloading}
        setDownloading={setDownloading}
        cardLoading={cardLoading}
        setCardLoading={setCardLoading}
        bankLoading={bankLoading}
        setBankLoading={setBankLoading}
        onInvoiceUpdate={setRegistrationInvoice}
      />
    );
  }

  const isArabic = i18n.language === "ar";
  const emptyView = createInvoicePresentation(
    { invoiceNumber: "", caseReference: null, studentName: null, issuedAt: new Date(0).toISOString() },
    {},
    isArabic,
  );
  if (!invoice) {
    return (
      <main dir={isArabic ? "rtl" : "ltr"} className="flex min-h-screen items-center justify-center bg-editorial-paper p-6 text-center text-muted-foreground">
        {loadFailed ? emptyView.labels.loadError : emptyView.labels.notFound}
      </main>
    );
  }

  const meta = {
    invoiceNumber: invoice.invoice_number,
    caseReference: invoice.case_reference,
    studentName: invoice.student_name,
    issuedAt: invoice.issued_at,
  };
  const view = createInvoicePresentation(meta, invoice.totals, isArabic);
  const { labels: L, totals: t } = view;
  const handleDownload = async () => {
    setDownloading(true);
    try { await downloadInvoicePdf(meta, t, isArabic); } finally { setDownloading(false); }
  };

  const info = [
    [L.invoiceNumber, invoice.invoice_number, "ltr"],
    [L.issuedAt, new Date(invoice.issued_at).toLocaleDateString("en-US"), "ltr"],
    [L.caseReference, invoice.case_reference ?? "—", "ltr"],
    [L.student, invoice.student_name ?? "—", isArabic ? "rtl" : "ltr"],
  ];

  return (
    <main dir={isArabic ? "rtl" : "ltr"} className="min-h-screen bg-editorial-paper px-3 py-4 text-foreground sm:px-6 sm:py-8 print:bg-background print:p-0">
      <div className="mx-auto mb-3 flex max-w-[794px] justify-end print:hidden">
        <Button onClick={handleDownload} disabled={downloading} className="gap-2">
          {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          {L.download}
        </Button>
      </div>
      <article className="mx-auto min-h-[900px] max-w-[794px] overflow-hidden border border-border bg-background shadow-surface-lg print:min-h-0 print:border-0 print:shadow-none">
        <header className="px-5 pb-0 pt-8 text-center sm:px-10 sm:pt-10">
          <img src={darbLogoAsset.url} alt={L.brandLine} className="mx-auto h-auto w-32 sm:w-36" />
          <p className="mt-2 text-xs text-muted-foreground">{L.brandLine}</p>
          <div className="mt-5 h-1 w-full bg-[#f9b115]" />
        </header>
        <div className="space-y-7 px-5 py-7 sm:px-10 sm:py-9">
          <section className="flex flex-col gap-2 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
            <h1 className="text-2xl font-bold text-primary sm:text-3xl">{L.title}</h1>
            <p dir="ltr" className="font-mono text-xs font-semibold text-muted-foreground sm:text-sm">{invoice.invoice_number}</p>
          </section>
          <dl className="grid gap-x-8 gap-y-4 border border-border bg-muted/40 p-4 sm:grid-cols-2 sm:p-5">
            {info.map(([label, value, direction]) => (
              <div key={label} className="min-w-0 border-b border-border/70 pb-3 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd dir={direction} className="mt-1 break-words text-sm font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          <section>
            <h2 className="mb-3 text-sm font-bold text-primary">{L.services}</h2>
            <div className="overflow-hidden border border-border">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 bg-muted/60 px-4 py-3 text-xs font-semibold text-muted-foreground"><span>{L.service}</span><span>{L.amount}</span></div>
              <ul className="divide-y divide-border">
                {t.services.map((service) => (
                  <li key={service.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 px-4 py-3 text-sm">
                    <div className="min-w-0"><p className="break-words">{service.description}</p>{service.quantity > 1 && <p dir="ltr" className="mt-1 text-xs text-muted-foreground">{service.quantity} × {formatInvoiceMoney(service.unit_price, service.currency)}</p>}</div>
                    <span dir="ltr" className="whitespace-nowrap font-medium">{formatInvoiceMoney(service.line_total, service.currency)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
          <section className="ms-auto w-full space-y-2 text-sm sm:max-w-sm">
            <div className="flex justify-between gap-4"><span className="text-muted-foreground">{L.subtotal}</span><span dir="ltr">{formatInvoiceMoney(t.subtotal)}</span></div>
            {t.discount_total > 0 && <div className="flex justify-between gap-4 text-trust"><span>{L.discount}</span><span dir="ltr">−{formatInvoiceMoney(t.discount_total)}</span></div>}
            {t.referral_discount > 0 && <div className="flex justify-between gap-4 text-trust"><span>{L.referralDiscount}</span><span dir="ltr">−{formatInvoiceMoney(t.referral_discount)}</span></div>}
            <div className="flex justify-between gap-4 border-t border-border pt-3 text-base font-bold"><span>{L.total}</span><span dir="ltr">{formatInvoiceMoney(t.service_total)}</span></div>
            {t.total_confirmed > 0 && <div className="flex justify-between gap-4 text-trust"><span>{L.paid}</span><span dir="ltr">{formatInvoiceMoney(t.total_confirmed)}</span></div>}
            {t.total_confirmed > 0 && t.remaining > 0 && <div className="flex justify-between gap-4 font-bold text-primary"><span>{L.remaining}</span><span dir="ltr">{formatInvoiceMoney(t.remaining)}</span></div>}
          </section>
          {view.fullyPaid && <p className="border border-trust/25 bg-trust/10 px-4 py-3 text-sm font-bold text-trust">✓ {L.fullyPaid}</p>}
          {invoice.case_reference && <p className="border border-primary/30 bg-primary/5 px-4 py-3 text-sm font-medium">{L.memoNote} <span dir="ltr" className="font-mono">{invoice.case_reference}</span></p>}
          <p className="border border-dashed border-border px-4 py-3 text-xs leading-6 text-muted-foreground">{L.separationNote}</p>
        </div>
        <footer className="mx-5 border-t-2 border-[#f9b115] px-0 py-6 text-xs text-muted-foreground sm:mx-10">
          <p>{L.support}</p><p dir="ltr" className="mt-2">darb.agency · +49 176 23790623</p>
        </footer>
      </article>
    </main>
  );
}

function RegistrationInvoiceView({
  invoice,
  token,
  language,
  downloading,
  setDownloading,
  cardLoading,
  setCardLoading,
  bankLoading,
  setBankLoading,
  onInvoiceUpdate,
}: {
  invoice: RegistrationInvoice;
  token: string;
  language: string;
  downloading: boolean;
  setDownloading: (value: boolean) => void;
  cardLoading: boolean;
  setCardLoading: (value: boolean) => void;
  bankLoading: boolean;
  setBankLoading: (value: boolean) => void;
  onInvoiceUpdate: (invoice: RegistrationInvoice) => void;
}) {
  const isArabic = language.startsWith("ar");
  const isHebrew = language.startsWith("he");
  const labels = useMemo(() => {
    const base = isArabic
      ? { title: "فاتورة تسجيل درب", invoice: "الفاتورة", reference: "رقم التسجيل", issued: "تاريخ الإصدار", due: "تاريخ الاستحقاق", student: "الطالب", referredBy: "أحال الطالب", type: "نوع الإحالة", friend: "صديق", family: "فرد من العائلة", details: "تفاصيل التسجيل", item: "البند", amount: "المبلغ", total: "الإجمالي المطلوب", bank: "التحويل البنكي", bankName: "البنك", holder: "صاحب الحساب", iban: "IBAN", bic: "BIC", memo: "استخدم رقم التسجيل هذا في خانة الملاحظات عند التحويل:", card: "الدفع بالبطاقة", payCard: "الدفع بالبطاقة", bankAction: "سأقوم بالتحويل البنكي", submitted: "تم تسجيل التحويل — بانتظار تأكيد درب", download: "تنزيل PDF", contact: "تواصل مع درب", cancelled: "الفاتورة ملغاة", paid: "مدفوعة", pending: "بانتظار الدفع", failed: "الدفع لم يكتمل" }
      : isHebrew
        ? { title: "חשבונית רישום DARB", invoice: "חשבונית", reference: "מספר רישום", issued: "הונפקה", due: "לתשלום עד", student: "סטודנט", referredBy: "הופנה על ידי", type: "סוג הפניה", friend: "חבר", family: "בן משפחה", details: "פרטי הרישום", item: "פריט", amount: "סכום", total: 'סה״כ לתשלום', bank: "העברה בנקאית", bankName: "בנק", holder: "בעל החשבון", iban: "IBAN", bic: "BIC", memo: "יש לציין את מספר הרישום בהערות ההעברה:", card: "תשלום בכרטיס", payCard: "שלם בכרטיס", bankAction: "אסמן שביצעתי העברה", submitted: "ההעברה סומנה — ממתינים לאישור DARB", download: "הורדת PDF", contact: "יצירת קשר עם DARB", cancelled: "החשבונית מבוטלת", paid: "שולם", pending: "ממתין לתשלום", failed: "התשלום לא הושלם" }
        : { title: "DARB Registration Invoice", invoice: "Invoice", reference: "Registration reference", issued: "Issued", due: "Due", student: "Student", referredBy: "Referred by", type: "Referral type", friend: "Friend", family: "Family member", details: "Registration details", item: "Item", amount: "Amount", total: "Total due", bank: "Bank transfer", bankName: "Bank", holder: "Account holder", iban: "IBAN", bic: "BIC", memo: "Use this registration reference as the bank-transfer memo:", card: "Card payment", payCard: "Pay by card", bankAction: "I made the bank transfer", submitted: "Transfer submitted — awaiting DARB confirmation", download: "Download PDF", contact: "Contact DARB", cancelled: "Invoice cancelled", paid: "Paid", pending: "Awaiting payment", failed: "Payment failed" };
    return base;
  }, [isArabic, isHebrew]);

  const invoiceUrl = `https://darb.agency/invoice/${encodeURIComponent(token)}`;
  const currency = invoice.currency || "EUR";
  const statusLabel = invoice.status === "cancelled" ? labels.cancelled : invoice.payment_status === "paid" ? labels.paid : invoice.payment_status === "failed" ? labels.failed : invoice.payment_status === "submitted" ? labels.submitted : labels.pending;

  const payByCard = async () => {
    setCardLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-student-referral-checkout", { body: { token } });
      if (error) throw error;
      if (data?.paid) {
        onInvoiceUpdate({ ...invoice, payment_status: "paid", status: "paid" });
        return;
      }
      if (!data?.checkout_url) throw new Error("Card payment is not configured");
      window.location.href = data.checkout_url;
    } catch (error: any) {
      window.alert(error?.message || "Card payment is not available right now.");
    } finally {
      setCardLoading(false);
    }
  };

  const markBankTransfer = async () => {
    setBankLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc("submit_registration_bank_transfer", { p_token: token });
      if (error) throw error;
      const nextPayments = [...(invoice.payments ?? [])];
      nextPayments.unshift({ id: data.payment_id, status: "submitted", payment_method: "bank_transfer", amount: invoice.total_amount, currency: invoice.currency, reference: data.reference });
      onInvoiceUpdate({ ...invoice, payment_status: "submitted", payments: nextPayments });
    } catch (error: any) {
      window.alert(error?.message || "Could not record the transfer.");
    } finally {
      setBankLoading(false);
    }
  };

  const download = async () => {
    setDownloading(true);
    try {
      await downloadRegistrationInvoicePdf({
        invoiceNumber: invoice.invoice_number,
        caseReference: invoice.case_reference,
        studentName: invoice.student_name,
        referrerName: invoice.referrer_name,
        referralType: invoice.referral_type,
        issuedAt: invoice.issued_at,
        dueAt: invoice.due_at,
        currency,
        items: invoice.items ?? [],
        subtotal: Number(invoice.subtotal),
        totalAmount: Number(invoice.total_amount),
        bankDetails: invoice.bank_details,
      }, isArabic);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <main dir={isArabic || isHebrew ? "rtl" : "ltr"} className="min-h-screen bg-editorial-paper px-3 py-4 text-foreground sm:px-6 sm:py-8">
      <div className="mx-auto flex max-w-[900px] justify-end pb-3"><Button onClick={download} disabled={downloading} className="gap-2">{downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}{labels.download}</Button></div>
      <article className="mx-auto max-w-[900px] overflow-hidden border border-border bg-background shadow-surface-lg">
        <header className="px-5 pt-8 text-center sm:px-10"><img src={darbLogoAsset.url} alt="DARB" className="mx-auto w-32 sm:w-36" /><div className="mt-5 h-1 w-full bg-[#f9b115]" /></header>
        <div className="space-y-7 px-5 py-7 sm:px-10 sm:py-10">
          <section className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between"><h1 className="text-2xl font-bold text-primary sm:text-3xl">{labels.title}</h1><p dir="ltr" className="font-mono text-sm font-semibold text-muted-foreground">{invoice.invoice_number}</p></section>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={invoice.payment_status === "paid" ? "success" : invoice.status === "cancelled" ? "destructive" : "secondary"}>{statusLabel}</Badge>
            <Badge variant="outline">{invoice.referral_type === "family" ? labels.family : labels.friend}</Badge>
          </div>

          <dl className="grid gap-x-8 gap-y-4 border border-border bg-muted/40 p-4 sm:grid-cols-2 sm:p-5">
            <Meta label={labels.invoice} value={invoice.invoice_number} />
            <Meta label={labels.reference} value={invoice.case_reference} dir="ltr" />
            <Meta label={labels.issued} value={new Date(invoice.issued_at).toLocaleDateString("en-US")} dir="ltr" />
            <Meta label={labels.due} value={invoice.due_at ? new Date(invoice.due_at).toLocaleDateString("en-US") : "—"} dir="ltr" />
            <Meta label={labels.student} value={invoice.student_name} />
            {invoice.referrer_name ? <Meta label={labels.referredBy} value={invoice.referrer_name} /> : null}
            {invoice.referral_type ? <Meta label={labels.type} value={invoice.referral_type === "family" ? labels.family : labels.friend} /> : null}
          </dl>

          <section>
            <h2 className="mb-3 text-sm font-bold text-primary">{labels.details}</h2>
            <div className="overflow-hidden border border-border">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 bg-muted/60 px-4 py-3 text-xs font-semibold text-muted-foreground"><span>{labels.item}</span><span>{labels.amount}</span></div>
              <ul className="divide-y divide-border">
                {(invoice.items ?? []).map((item, index) => (
                  <li key={index} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-4 py-4 text-sm">
                    <div className="min-w-0"><p className="font-medium">{isArabic ? item.name_ar || item.name_en : item.name_en || item.name_ar}</p><p className="mt-1 text-xs text-muted-foreground">{formatInvoiceItemBilling(item, currency, isArabic)}</p></div>
                    <span dir="ltr" className="whitespace-nowrap font-medium">{money(Number(item.total), currency)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="ms-auto w-full space-y-2 sm:max-w-sm"><MoneyRow label={labels.item === "البند" ? "المجموع الفرعي" : labels.item === "פריט" ? "סכום ביניים" : "Subtotal"} value={money(invoice.subtotal, currency)} /><MoneyRow label={labels.total} value={money(invoice.total_amount, currency)} strong /></section>

          {invoice.case_reference ? <p className="border border-primary/30 bg-primary/5 px-4 py-3 text-sm leading-6">{labels.memo} <span dir="ltr" className="font-mono font-semibold">{invoice.case_reference}</span></p> : null}

          {invoice.status !== "cancelled" && invoice.payment_status !== "paid" ? (
            <section className="grid gap-4 md:grid-cols-2">
              <Card title={labels.card} icon={<CreditCard className="size-5" />} description={invoice.currency === "EUR" ? labels.card : "Card checkout is available only for EUR registration invoices."} action={<Button className="w-full" onClick={payByCard} disabled={cardLoading || invoice.currency !== "EUR"}>{cardLoading ? <Loader2 className="me-2 size-4 animate-spin" /> : <CreditCard className="me-2 size-4" />}{labels.payCard}</Button>} />
              <Card title={labels.bank} icon={<Landmark className="size-5" />} description={invoice.bank_details?.iban ? labels.bankAction : "Bank-transfer details have not been configured yet. Contact DARB."} action={invoice.bank_details?.iban ? <Button variant="outline" className="w-full" onClick={markBankTransfer} disabled={bankLoading || invoice.payment_status === "submitted"}>{bankLoading ? <Loader2 className="me-2 size-4 animate-spin" /> : <WalletCards className="me-2 size-4" />}{invoice.payment_status === "submitted" ? labels.submitted : labels.bankAction}</Button> : null} />
            </section>
          ) : null}

          {invoice.bank_details?.iban ? (
            <section className="rounded-2xl border bg-muted/20 p-5">
              <h2 className="flex items-center gap-2 text-sm font-bold text-primary"><Landmark className="size-4" />{labels.bank}</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Meta label={labels.bankName} value={invoice.bank_details.bank_name} />
                <Meta label={labels.holder} value={invoice.bank_details.account_holder} />
                <Meta label={labels.iban} value={invoice.bank_details.iban} dir="ltr" />
                <Meta label={labels.bic} value={invoice.bank_details.bic} dir="ltr" />
              </div>
            </section>
          ) : null}

          <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:justify-center">
            <a href="tel:+4917623790623" className="inline-flex h-10 items-center justify-center gap-2 rounded-md border px-5 text-sm font-medium hover:bg-muted"><Phone className="size-4" />{labels.contact}</a>
            <a href={invoiceUrl} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border px-5 text-sm font-medium hover:bg-muted"><ExternalLink className="size-4" />{labels.invoice}</a>
          </div>
        </div>
        <footer className="border-t-2 border-[#f9b115] px-5 py-5 text-center text-xs text-muted-foreground sm:px-10"><p>darb.agency · +49 176 23790623</p></footer>
      </article>
    </main>
  );
}

function Card({ title, icon, description, action }: { title: string; icon: React.ReactNode; description: string; action?: React.ReactNode }) {
  return <div className="rounded-2xl border bg-card p-5"><div className="flex items-center gap-2 text-sm font-semibold">{icon}{title}</div><p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>{action ? <div className="mt-4">{action}</div> : null}</div>;
}

function Meta({ label, value, dir }: { label: string; value: string | null | undefined; dir?: "ltr" | "rtl" }) {
  return <div className="min-w-0 border-b border-border/70 pb-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd dir={dir} className="mt-1 break-words text-sm font-semibold">{value || "—"}</dd></div>;
}

function MoneyRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <div className={strong ? "flex justify-between gap-4 border-t pt-3 text-base font-bold" : "flex justify-between gap-4 text-sm"}><span className="text-muted-foreground">{label}</span><span dir="ltr">{value}</span></div>;
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0)) + " " + currency;
}
