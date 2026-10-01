import { ExternalLink, FileText, CheckCircle2, Clock3, CreditCard, Landmark } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toneClasses } from "@/lib/statusTokens";

interface Props {
  invoice: any | null;
  caseStatus?: string;
}

function money(value: unknown, currency = "EUR") {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0)) + " " + currency;
}

export default function DirectRegistrationFinance({ invoice, caseStatus }: Props) {
  const { t, i18n } = useTranslation("dashboard");
  const lang = i18n.language ?? "en";
  const isArabic = lang.startsWith("ar");
  const isPaid = invoice?.payment_status === "paid";
  const isSubmitted = caseStatus === "submitted" || caseStatus === "enrollment_paid" || caseStatus === "enrolled";

  if (!invoice) {
    return (
      <Card>
        <CardContent className="p-5 text-sm text-muted-foreground">
          {t(
            "referralRegistration.caseSummary.invoiceMissing",
            "The direct registration invoice could not be loaded.",
          )}
        </CardContent>
      </Card>
    );
  }

  const status = isPaid
    ? t("referralRegistration.caseSummary.paid", "Paid")
    : invoice.payment_status === "submitted"
      ? t("referralRegistration.caseSummary.transferSubmitted", "Transfer submitted")
      : invoice.payment_status === "failed"
        ? t("referralRegistration.caseSummary.paymentFailed", "Payment failed")
        : t("referralRegistration.caseSummary.pending", "Payment pending");

  return (
    <div className="space-y-3">
      <Card className="border-primary/20">
        <CardHeader className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="size-4" />
              {t("referralRegistration.caseSummary.financeTitle", "Refer & Register finance")}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={isPaid ? "success" : "secondary"}>{status}</Badge>
              {invoice.referral_type ? (
                <Badge variant="outline">
                  {invoice.referral_type === "family"
                    ? t("referralRegistration.family", "Family member")
                    : t("referralRegistration.friend", "Friend")}
                </Badge>
              ) : null}
            </div>
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            {isPaid
              ? t(
                  "referralRegistration.caseSummary.paidDescription",
                  "This registration has its own paid EUR invoice. No separate DARB service invoice or office appointment is required.",
                )
              : t(
                  "referralRegistration.caseSummary.pendingDescription",
                  "The registration remains blocked until its registration invoice is paid and confirmed.",
                )}
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Meta label={t("referralRegistration.caseSummary.invoice", "Invoice")} value={invoice.invoice_number} dir="ltr" />
            <Meta
              label={t("referralRegistration.caseSummary.referrer", "Referred by")}
              value={invoice.referrer_name}
            />
            <Meta
              label={t("referralRegistration.caseSummary.total", "Registration total")}
              value={money(invoice.total_amount, invoice.currency || "EUR")}
              dir="ltr"
            />
            <Meta
              label={t("referralRegistration.caseSummary.paymentStatus", "Payment status")}
              value={status}
            />
          </div>

          {invoice.discount_amount > 0 ? (
            <div className="rounded-xl border bg-primary/5 p-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">
                  {t("referralRegistration.caseSummary.discount", "Referral discount")}
                </span>
                <span className="font-semibold" dir="ltr">
                  −{money(invoice.discount_amount, invoice.currency || "EUR")}
                </span>
              </div>
            </div>
          ) : null}

          <Separator />

          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <CreditCard className="size-4 text-primary" />
              {t("referralRegistration.caseSummary.registrationInvoice", "Registration invoice")}
            </div>
            <div className="divide-y divide-border rounded-xl border">
              {(invoice.items ?? []).map((item: any, index: number) => (
                <div key={index} className="flex items-start justify-between gap-4 p-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{isArabic ? item.name_ar || item.name_en : item.name_en || item.name_ar}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.weeks ? item.weeks + " " + t("referralRegistration.pricing.weeks", "weeks") : ""}
                      {item.months ? item.months + " " + t("referralRegistration.pricing.months", "months") : ""}
                    </p>
                  </div>
                  <span dir="ltr" className="shrink-0 font-semibold">
                    {money(item.total, invoice.currency || "EUR")}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border bg-muted/20 p-3 text-sm">
            {isPaid ? (
              <CheckCircle2 className={"mt-0.5 size-4 " + toneClasses("paid").text} />
            ) : (
              <Clock3 className={"mt-0.5 size-4 " + toneClasses("payment").text} />
            )}
            <div>
              <p className="font-semibold">
                {isPaid
                  ? t("referralRegistration.caseSummary.readyForReview", "Ready for profile review")
                  : t("referralRegistration.caseSummary.waitingForPayment", "Waiting for registration payment")}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {isSubmitted
                  ? t("referralRegistration.caseSummary.submittedHint", "This registration is already in the Admin review lifecycle.")
                  : t(
                      "referralRegistration.caseSummary.reviewHint",
                      "Once the payment is confirmed, review the submitted profile and use the top action to confirm it.",
                    )}
              </p>
            </div>
          </div>

          {invoice.public_token ? (
            <a
              href={"/invoice/" + encodeURIComponent(invoice.public_token)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-10 items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              <Landmark className="size-4" />
              {t("referralRegistration.caseSummary.openInvoice", "Open registration invoice")}
              <ExternalLink className="size-4" />
            </a>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function Meta({ label, value, dir }: { label: string; value: string | null | undefined; dir?: "ltr" | "rtl" }) {
  return (
    <div className="rounded-xl border bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p dir={dir} className="mt-1 break-words text-sm font-semibold">{value || "—"}</p>
    </div>
  );
}
