import React from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Wallet } from "lucide-react";
import { formatILS } from "@/lib/money";
import { useCaseServices } from "@/hooks/useCaseServices";
import { useCasePayments } from "@/hooks/useCasePayments";
import { useInvoices } from "@/hooks/useInvoices";
import CaseServices from "./CaseServices";
import CasePayments from "./CasePayments";
import CaseInvoices from "./CaseInvoices";

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

const CaseFinance: React.FC<Props> = ({ caseId, canManage = false, extraLines = [] }) => {
  const { t } = useTranslation("dashboard");
  const { services, total: servicesTotal, refetch: refetchServices } = useCaseServices(caseId);
  const { payments, totalPaid, refetch: refetchPayments } = useCasePayments(caseId);
  const { invoices, refetch: refetchInvoices } = useInvoices(caseId);

  const invoicedTotal = invoices
    .filter((i) => i.status !== "void")
    .reduce((sum, i) => sum + i.total, 0);
  const remaining = Math.max(servicesTotal - totalPaid, 0);

  const onServicesChanged = () => {
    refetchServices();
    refetchInvoices();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            {t("finance.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">{t("finance.summary.services")}</p>
              <p className="text-sm font-semibold">{formatILS(servicesTotal)}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">{t("finance.summary.invoiced")}</p>
              <p className="text-sm font-semibold">{formatILS(invoicedTotal)}</p>
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

          {extraLines.length > 0 && (
            <div className="space-y-1.5 text-sm">
              <p className="text-xs font-medium text-muted-foreground">
                {t("finance.summary.programCosts")}
              </p>
              {extraLines.map((line) => (
                <div key={line.label} className="flex justify-between gap-2 text-muted-foreground">
                  <span className="truncate flex-1 min-w-0">{line.label}</span>
                  <span className="font-medium text-foreground shrink-0 whitespace-nowrap">
                    {line.amount.toLocaleString("en-US")} {line.currency ?? "EUR"}
                  </span>
                </div>
              ))}
            </div>
          )}

          <Separator />

          <CaseServices
            caseId={caseId}
            services={services}
            canManage={canManage}
            onChanged={onServicesChanged}
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

      <CaseInvoices caseId={caseId} canManage={canManage} />
    </div>
  );
};

export default CaseFinance;
