import React from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Wallet } from "lucide-react";
import { formatILS } from "@/lib/money";
import { useCaseServices } from "@/hooks/useCaseServices";
import { useCasePayments } from "@/hooks/useCasePayments";
import CaseServices from "./CaseServices";
import CasePayments from "./CasePayments";

export interface FinanceExtraLine {
  label: string;
  amount: number;
  currency?: string;
}

interface Props {
  caseId: string;
  /** Admin or the assigned team member. */
  canManage?: boolean;
  /** Non-shekel programme costs coming from the application (EUR etc.). */
  extraLines?: FinanceExtraLine[];
}

/**
 * The single financial view of a case: services attached, discounts applied,
 * money received and what is still outstanding. There is no separate invoice.
 */
const CaseFinance: React.FC<Props> = ({ caseId, canManage = false, extraLines = [] }) => {
  const { t } = useTranslation("dashboard");
  const { services, total: servicesTotal, refetch: refetchServices } = useCaseServices(caseId);
  const { payments, totalPaid, refetch: refetchPayments } = useCasePayments(caseId);

  const discountTotal = services.reduce((sum, s) => sum + Number(s.discount || 0), 0);
  const remaining = Math.max(servicesTotal - totalPaid, 0);
  const extraSubtotals = React.useMemo(
    () =>
      extraLines.reduce<Record<string, number>>((acc, line) => {
        const cur = line.currency ?? "EUR";
        acc[cur] = (acc[cur] ?? 0) + Number(line.amount || 0);
        return acc;
      }, {}),
    [extraLines],
  );
  const status: "unpaid" | "partial" | "settled" =
    servicesTotal <= 0 ? "unpaid" : remaining <= 0 ? "settled" : totalPaid > 0 ? "partial" : "unpaid";
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
          <CardTitle className="text-base flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              {t("finance.title")}
            </span>
            <Badge className={statusClass}>{t(`finance.status.${status}`)}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Agency money is shekel work tracked against services and payments. */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              {t("finance.summary.agencyBlock")}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">{t("finance.summary.services")}</p>
                <p className="text-sm font-semibold">{formatILS(servicesTotal)}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">{t("finance.summary.discounts")}</p>
                <p className="text-sm font-semibold">{formatILS(discountTotal)}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">{t("finance.summary.paid")}</p>
                <p className="text-sm font-semibold text-emerald-700">{formatILS(totalPaid)}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">{t("finance.summary.remaining")}</p>
                <p
                  className={`text-sm font-semibold ${remaining > 0 ? "text-amber-600" : "text-muted-foreground"}`}
                >
                  {formatILS(remaining)}
                </p>
              </div>
            </div>
          </div>

          {/* School-billed costs are in euro and are never mixed into the shekel
              totals above — they are shown with their own subtotal per currency. */}
          {extraLines.length > 0 && (
            <div className="space-y-1.5 text-sm rounded-md border p-3">
              <p className="text-xs font-medium text-muted-foreground">
                {t("finance.summary.schoolBlock")}
              </p>
              {extraLines.map((line) => (
                <div key={line.label} className="flex justify-between gap-2 text-muted-foreground">
                  <span className="truncate flex-1 min-w-0">{line.label}</span>
                  <span className="font-medium text-foreground shrink-0 whitespace-nowrap">
                    {line.amount.toLocaleString("en-US")} {line.currency ?? "EUR"}
                  </span>
                </div>
              ))}
              {Object.entries(extraSubtotals).map(([currency, amount]) => (
                <div
                  key={currency}
                  className="flex justify-between gap-2 border-t pt-1.5 text-sm font-semibold"
                >
                  <span>{t("finance.summary.subtotal")}</span>
                  <span className="whitespace-nowrap">
                    {amount.toLocaleString("en-US")} {currency}
                  </span>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">{t("finance.summary.noCrossCurrency")}</p>
            </div>
          )}


          <Separator />

          <CaseServices
            caseId={caseId}
            services={services}
            canManage={canManage}
            onChanged={refetchServices}
          />

          <Separator />

          <CasePayments
            caseId={caseId}
            payments={payments}
            canManage={canManage}
            onChanged={refetchPayments}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default CaseFinance;

