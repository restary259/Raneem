import React from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Wallet } from "lucide-react";
import { formatILS } from "@/lib/money";
import { useCaseServices } from "@/hooks/useCaseServices";
import { useCaseFinancials, type FinancialSchoolLine } from "@/hooks/useCaseFinancials";
import CaseServices from "./CaseServices";
import CasePayments from "./CasePayments";

interface Props {
  caseId: string;
  /** Admin or the assigned team member. */
  canManage?: boolean;
  /** Admin only — confirm/reject submitted payments. */
  canConfirm?: boolean;
}

const fmtMoney = (amount: number, currency: string) =>
  currency === "ILS" ? formatILS(amount) : `${amount.toLocaleString("en-US")} ${currency}`;

/**
 * The single financial view of a case. Every number here comes from the
 * server-side `get_case_financials` calculation — nothing is re-summed in the
 * browser, so the UI total and the database can never drift apart.
 */
const CaseFinance: React.FC<Props> = ({ caseId, canManage = false, canConfirm = false }) => {
  const { t, i18n } = useTranslation("dashboard");
  const isArabic = i18n.language?.startsWith("ar");
  const { services, refetch: refetchServices } = useCaseServices(caseId);
  const { financials, refetch: refetchFinancials } = useCaseFinancials(caseId);

  const serviceTotal = financials?.service_total ?? 0;
  const paid = financials?.total_confirmed ?? 0;
  const pendingReview = financials?.total_pending_review ?? 0;
  const remaining = financials?.remaining ?? 0;
  const schoolCosts = financials?.school_costs ?? [];

  const schoolSubtotals = React.useMemo(
    () =>
      schoolCosts.reduce<Record<string, number>>((acc, line) => {
        acc[line.currency] = (acc[line.currency] ?? 0) + Number(line.total || 0);
        return acc;
      }, {}),
    [schoolCosts],
  );

  const lineName = (l: FinancialSchoolLine) =>
    (isArabic ? l.name_ar || l.name_en : l.name_en || l.name_ar) ?? "";

  const status: "unpaid" | "partial" | "settled" =
    serviceTotal <= 0 ? "unpaid" : remaining <= 0 ? "settled" : paid > 0 ? "partial" : "unpaid";
  const statusClass =
    status === "settled"
      ? "bg-emerald-100 text-emerald-800"
      : status === "partial"
        ? "bg-amber-100 text-amber-800"
        : "bg-slate-100 text-slate-800";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              {t("finance.title")}
            </span>
            <Badge className={statusClass}>{t(`finance.status.${status}`)}</Badge>
          </CardTitle>
          {financials?.case_reference && (
            <p className="text-xs text-muted-foreground">
              {financials.case_reference}
              {financials.student_name ? ` · ${financials.student_name}` : ""}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Agency money — shekels, tracked against services and payments. */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              {t("finance.summary.agencyBlock")}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">{t("finance.summary.services")}</p>
                <p className="text-sm font-semibold break-words">{formatILS(serviceTotal)}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">{t("finance.summary.paid")}</p>
                <p className="text-sm font-semibold text-emerald-700 break-words">
                  {formatILS(paid)}
                </p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">
                  {t("finance.summary.pendingReview")}
                </p>
                <p className="text-sm font-semibold text-amber-600 break-words">
                  {formatILS(pendingReview)}
                </p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">{t("finance.summary.remaining")}</p>
                <p
                  className={`text-sm font-semibold break-words ${remaining > 0 ? "text-amber-600" : "text-muted-foreground"}`}
                >
                  {formatILS(remaining)}
                </p>
              </div>
            </div>
          </div>

          {/* School-billed costs are euro and are never summed into the shekel
              totals above. The course line shows the full weekly × weeks maths. */}
          {schoolCosts.length > 0 && (
            <div className="space-y-1.5 text-sm rounded-md border p-3">
              <p className="text-xs font-medium text-muted-foreground">
                {t("finance.summary.schoolBlock")}
              </p>
              {schoolCosts.map((line) => (
                <div key={line.kind} className="space-y-0.5">
                  <div className="flex flex-wrap justify-between gap-2 text-muted-foreground">
                    <span className="min-w-0 break-words">
                      {t(`finance.summary.kind.${line.kind}`)} — {lineName(line)}
                    </span>
                    <span className="font-medium text-foreground whitespace-nowrap">
                      {fmtMoney(line.total, line.currency)}
                    </span>
                  </div>
                  {line.weekly_price ? (
                    <p className="text-xs text-muted-foreground">
                      {fmtMoney(line.weekly_price, line.currency)} × {line.weeks}{" "}
                      {t("finance.summary.weeks")} = {fmtMoney(line.total, line.currency)}
                    </p>
                  ) : null}
                </div>
              ))}
              {Object.entries(schoolSubtotals).map(([currency, amount]) => (
                <div
                  key={currency}
                  className="flex justify-between gap-2 border-t pt-1.5 text-sm font-semibold"
                >
                  <span>{t("finance.summary.subtotal")}</span>
                  <span className="whitespace-nowrap">{fmtMoney(amount, currency)}</span>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">{t("finance.summary.estimateNote")}</p>
              <p className="text-xs text-muted-foreground">{t("finance.summary.noCrossCurrency")}</p>
            </div>
          )}

          <Separator />

          <CaseServices
            caseId={caseId}
            services={services}
            canManage={canManage}
            onChanged={() => {
              refetchServices();
              refetchFinancials();
            }}
          />

          <Separator />

          <CasePayments
            caseId={caseId}
            payments={financials?.payments ?? []}
            canManage={canManage}
            canConfirm={canConfirm}
            onChanged={refetchFinancials}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default CaseFinance;
