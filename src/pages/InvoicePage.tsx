import React, { useEffect, useState } from "react";
import { useParams } from "@/lib/router-compat";
import { useTranslation } from "react-i18next";
import { Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import darbLogoAsset from "@/assets/darb-logo.png.asset.json";
import { downloadInvoicePdf } from "@/utils/invoicePdf";
import { createInvoicePresentation, formatInvoiceMoney } from "@/utils/invoicePresentation";

interface PublicInvoice {
  invoice_number: string;
  case_reference: string | null;
  student_name: string | null;
  issued_at: string;
  totals: unknown;
}

export default function InvoicePage() {
  const { token } = useParams<{ token: string }>();
  const { i18n } = useTranslation();
  const isArabic = i18n.language === "ar";
  const [invoice, setInvoice] = useState<PublicInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!token) return;
      const { data } = await (supabase as any).rpc("get_invoice_by_token", { p_token: token });
      if (active) setInvoice((data as PublicInvoice) ?? null);
    })().finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [token]);

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-editorial-paper"><Loader2 className="size-5 animate-spin text-muted-foreground" /></main>;

  const emptyView = createInvoicePresentation(
    { invoiceNumber: "", caseReference: null, studentName: null, issuedAt: new Date(0).toISOString() },
    {},
    isArabic,
  );
  if (!invoice) return <main dir={isArabic ? "rtl" : "ltr"} className="flex min-h-screen items-center justify-center bg-editorial-paper p-6 text-center text-muted-foreground">{emptyView.labels.notFound}</main>;

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
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 bg-muted/60 px-4 py-3 text-xs font-semibold text-muted-foreground">
                <span>{L.service}</span><span>{L.amount}</span>
              </div>
              <ul className="divide-y divide-border">
                {t.services.map((service) => (
                  <li key={service.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 px-4 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="break-words">{service.description}</p>
                      {service.quantity > 1 && <p dir="ltr" className="mt-1 text-xs text-muted-foreground">{service.quantity} × {formatInvoiceMoney(service.unit_price, service.currency)}</p>}
                    </div>
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
          <p className="border border-dashed border-border px-4 py-3 text-xs leading-6 text-muted-foreground">{L.separationNote}</p>
        </div>

        <footer className="mx-5 border-t-2 border-[#f9b115] px-0 py-6 text-xs text-muted-foreground sm:mx-10">
          <p>{L.support}</p>
          <p dir="ltr" className="mt-2">darb.agency · +49 176 23790623</p>
        </footer>
      </article>
    </main>
  );
}