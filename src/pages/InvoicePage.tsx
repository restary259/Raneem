import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Loader2 } from "lucide-react";
import { downloadInvoicePdf } from "@/utils/invoicePdf";
import { selectInvoiceTotals } from "@/utils/invoiceTotals";

interface PublicInvoice {
  invoice_number: string;
  case_reference: string | null;
  student_name: string | null;
  issued_at: string;
  totals: unknown;
}

const money = (n: number, currency: string) =>
  `${currency === "EUR" ? "€" : "₪"}${Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function InvoicePage() {
  const { token } = useParams<{ token: string }>();
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const [invoice, setInvoice] = useState<PublicInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    (async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      const { data } = await (supabase as any).rpc("get_invoice_by_token", { p_token: token });
      setInvoice((data as PublicInvoice) ?? null);
      setLoading(false);
    })();
  }, [token]);

  const L = isAr
    ? { title: "فاتورة خدمات دارب", student: "الطالب", caseRef: "رقم الملف", date: "التاريخ", agency: "خدمات دارب", total: "إجمالي خدمات دارب", referralDiscount: "خصم الإحالة", paid: "المدفوع المؤكد", remaining: "الرصيد المتبقي", download: "تنزيل PDF", notFound: "لم يتم العثور على الفاتورة أو انتهت صلاحية الرابط.", germanyNote: "تُدفع تكاليف المدرسة في ألمانيا (دورة اللغة والسكن والتأمين) بشكل منفصل وتتحقق منها الإدارة." }
    : { title: "DARB Service Invoice", student: "Student", caseRef: "Case", date: "Date", agency: "DARB agency services", total: "DARB services total", referralDiscount: "Referral discount", paid: "Confirmed payments", remaining: "Remaining balance", download: "Download PDF", notFound: "This invoice could not be found.", germanyNote: "Germany school costs (language course, accommodation, insurance) are billed separately and verified by Admin." };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!invoice) return <div className="p-10 text-center text-muted-foreground">{L.notFound}</div>;

  const t = selectInvoiceTotals(invoice.totals);
  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadInvoicePdf(
        { invoiceNumber: invoice.invoice_number, caseReference: invoice.case_reference, studentName: invoice.student_name, issuedAt: invoice.issued_at },
        t,
        isAr,
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <main dir={isAr ? "rtl" : "ltr"} className="mx-auto max-w-3xl p-4 sm:p-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">{L.title} {invoice.invoice_number}</h1>
        <Button onClick={handleDownload} disabled={downloading} size="sm">
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          <span className="ms-2">{L.download}</span>
        </Button>
      </div>
      <Card>
        <CardContent className="space-y-5 p-5">
          <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-3">
            <div><span className="text-muted-foreground">{L.student}: </span>{invoice.student_name ?? "-"}</div>
            <div><span className="text-muted-foreground">{L.caseRef}: </span>{invoice.case_reference ?? "-"}</div>
            <div><span className="text-muted-foreground">{L.date}: </span>{new Date(invoice.issued_at).toLocaleDateString("en-US")}</div>
          </div>
          <section>
            <h2 className="mb-2 text-sm font-semibold">{L.agency}</h2>
            <ul className="divide-y rounded-md border text-sm">
              {(t.services ?? []).map((s) => (
                <li key={s.id} className="flex justify-between gap-3 px-3 py-2">
                  <span>{s.description}{s.quantity > 1 ? ` × ${s.quantity}` : ""}</span>
                  <span className="font-medium">{money(s.line_total, s.currency)}</span>
                </li>
              ))}
            </ul>
          </section>

          {/*
            Germany school costs (language course, accommodation, insurance) are
            excluded from the student-facing invoice.  They are paid directly to
            the German providers and verified separately by the Admin after the
            student uploads proof of payment.  The full financials snapshot
            remains in the database totals column for the admin audit trail.
          */}
          <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">{L.germanyNote}</p>

          <div className="space-y-1 border-t pt-3 text-sm">
            {t.referral_discount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span className="text-muted-foreground">{L.referralDiscount}</span>
                <span dir="ltr" className="font-medium">−{money(t.referral_discount, t.currency)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">{L.total}</span>
              <span className="font-semibold">{money(t.service_total, t.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{L.paid}</span>
              <span>{money(t.total_confirmed, t.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{L.remaining}</span>
              <span className="font-semibold">{money(t.remaining, t.currency)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
