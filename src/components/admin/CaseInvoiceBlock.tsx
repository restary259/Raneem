import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Download, ExternalLink, Loader2, Receipt, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getCaseInvoice, invoiceUrl, issueCaseInvoice, sendInvoiceEmail, type CaseInvoice } from "@/services/CaseInvoiceService";
import { downloadInvoicePdf } from "@/utils/invoicePdf";
import { selectInvoiceTotals } from "@/utils/invoiceTotals";
import { toneClasses } from "@/lib/statusTokens";

/** Invoice summary inside Admin review. Invoices are created by Team submission. */
export default function CaseInvoiceBlock({ caseId, caseStatus }: { caseId: string; caseStatus?: string }) {
  const { t, i18n } = useTranslation("dashboard");
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

  const L = {
    title: t("admin.invoiceBlock.title", "DARB Service Invoice"),
    none: t(
      "admin.invoiceBlock.none",
      "The DARB service invoice is issued automatically when Team submits the case.",
    ),
    resend: t("admin.invoiceBlock.resend", "Resend email"),
    view: t("admin.invoiceBlock.view", "View"),
    pdf: t("admin.invoiceBlock.pdf", "PDF"),
    sent: t("admin.invoiceBlock.sent", "Emailed"),
    failed: t("admin.invoiceBlock.failed", "Email failed"),
    pending: t("admin.invoiceBlock.pending", "Email pending"),
    scopeNote: t(
      "admin.invoiceBlock.scopeNote",
      "DARB services only · ILS. Germany school costs are estimated separately in Finance.",
    ),
    issue: t("admin.invoiceBlock.issue", "Issue invoice"),
    issueDisabledHint: t(
      "admin.invoiceBlock.issueDisabledHint",
      "The invoice is issued automatically when the case is submitted to Admin.",
    ),
  };

  /** Manual issuance is only allowed once the case has been submitted; the
      backend enforces the same gate (INVOICE_BLOCKED) so the disabled state
      never lets Admin imply a manual bypass of the flow. */
  const canIssue = caseStatus === "submitted" || caseStatus === "enrollment_paid";

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      toast({ variant: "destructive", description: err instanceof Error ? err.message : String(err) });
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
              disabled={busy || !canIssue}
              title={!canIssue ? L.issueDisabledHint : undefined}
              onClick={() =>
                run(async () => {
                  const inv = await issueCaseInvoice(caseId);
                  setInvoice(inv);
                })
              }
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
              {L.issue}
            </Button>
          </div>
        ) : (
          <div className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm">{invoice.invoice_number}</span>
              <Badge variant="outline" className={invoice.email_status === "sent" ? toneClasses("paid").chip : invoice.email_status === "failed" ? toneClasses("danger").chip : "text-muted-foreground"}>
                {invoice.email_status === "sent" ? L.sent : invoice.email_status === "failed" ? L.failed : L.pending}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{L.scopeNote}</p>
            {invoice.email_error && <p className="text-xs text-destructive">{invoice.email_error}</p>}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => window.open(invoiceUrl(invoice.public_token), "_blank")}>
                <ExternalLink className="h-3.5 w-3.5" /> {L.view}
              </Button>
              <Button size="sm" variant="outline" className="h-8 gap-1" disabled={busy} onClick={() => run(() => downloadInvoicePdf({ invoiceNumber: invoice.invoice_number, caseReference: invoice.case_reference, studentName: invoice.student_name, issuedAt: invoice.issued_at }, selectInvoiceTotals(invoice.totals), isAr).then(() => undefined))}>
                <Download className="h-3.5 w-3.5" /> {L.pdf}
              </Button>
              <Button size="sm" variant="outline" className="h-8 gap-1" disabled={busy} onClick={() => run(async () => {
                const ok = await sendInvoiceEmail(invoice);
                const fresh = await getCaseInvoice(caseId);
                setInvoice(fresh);
                toast({ variant: ok ? undefined : "destructive", description: ok ? L.sent : L.failed });
              })}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} {L.resend}
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
