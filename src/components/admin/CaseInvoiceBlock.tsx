import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Download, ExternalLink, Loader2, Receipt, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  getCaseInvoice,
  issueCaseInvoice,
  invoiceUrl,
  sendInvoiceEmail,
  type CaseInvoice,
} from "@/services/CaseInvoiceService";
import { downloadInvoicePdf } from "@/utils/invoicePdf";

/** Invoice summary shown inside the admin submission review dialog. */
export default function CaseInvoiceBlock({ caseId }: { caseId: string }) {
  const { i18n } = useTranslation("dashboard");
  const isAr = i18n.language === "ar";
  const { toast } = useToast();
  const [invoice, setInvoice] = useState<CaseInvoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    getCaseInvoice(caseId)
      .then((inv) => active && setInvoice(inv))
      .catch(() => undefined)
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [caseId]);

  const L = isAr
    ? {
        title: "الفاتورة",
        none: "لم تُصدر فاتورة لهذا الملف بعد.",
        issue: "إصدار الفاتورة",
        resend: "إعادة إرسال بالبريد",
        view: "عرض",
        pdf: "PDF",
        sent: "تم الإرسال",
        failed: "فشل الإرسال",
        pending: "بانتظار الإرسال",
      }
    : {
        title: "Invoice",
        none: "No invoice has been issued for this case yet.",
        issue: "Issue invoice",
        resend: "Resend email",
        view: "View",
        pdf: "PDF",
        sent: "Emailed",
        failed: "Email failed",
        pending: "Email pending",
      };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      toast({
        variant: "destructive",
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return null;

  return (
    <>
      <Separator />
      <div>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Receipt className="h-4 w-4" /> {L.title}
        </h3>

        {!invoice ? (
          <div className="flex items-center justify-between gap-2 rounded-lg border border-border p-3">
            <p className="text-sm text-muted-foreground">{L.none}</p>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const inv = await issueCaseInvoice(caseId);
                  setInvoice(inv);
                })
              }
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : L.issue}
            </Button>
          </div>
        ) : (
          <div className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm">{invoice.invoice_number}</span>
              <Badge
                variant="outline"
                className={
                  invoice.email_status === "sent"
                    ? "border-emerald-300 text-emerald-700"
                    : invoice.email_status === "failed"
                      ? "border-destructive text-destructive"
                      : "text-muted-foreground"
                }
              >
                {invoice.email_status === "sent" ? L.sent : invoice.email_status === "failed" ? L.failed : L.pending}
              </Badge>
            </div>
            {invoice.email_error && <p className="text-xs text-destructive">{invoice.email_error}</p>}
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1"
                onClick={() => window.open(invoiceUrl(invoice.public_token), "_blank")}
              >
                <ExternalLink className="h-3.5 w-3.5" /> {L.view}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1"
                disabled={busy}
                onClick={() =>
                  run(() =>
                    downloadInvoicePdf(
                      {
                        invoiceNumber: invoice.invoice_number,
                        caseReference: invoice.case_reference,
                        studentName: invoice.student_name,
                        issuedAt: invoice.issued_at,
                      },
                      invoice.totals,
                      isAr,
                    ).then(() => undefined),
                  )
                }
              >
                <Download className="h-3.5 w-3.5" /> {L.pdf}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const ok = await sendInvoiceEmail(invoice);
                    const fresh = await getCaseInvoice(caseId);
                    setInvoice(fresh);
                    toast({
                      variant: ok ? undefined : "destructive",
                      description: ok ? L.sent : L.failed,
                    });
                  })
                }
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} {L.resend}
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
