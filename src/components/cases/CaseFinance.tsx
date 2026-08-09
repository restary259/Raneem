import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock3, Loader2, Wallet } from "lucide-react";
import { formatILS } from "@/lib/money";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCaseServices } from "@/hooks/useCaseServices";
import { useCaseFinancials, type FinancialSchoolLine } from "@/hooks/useCaseFinancials";
import CaseServices from "./CaseServices";
import CasePayments from "./CasePayments";

interface Props {
  caseId: string;

  /**
   * Admin or the assigned Team member.
   */
  canManage?: boolean;

  /**
   * Admin only.
   *
   * This is retained for the existing payment-history component.
   * German-side confirmation will be handled separately.
   */
  canConfirm?: boolean;
}

interface FinanceConfirmation {
  status: "pending" | "proof_submitted" | "confirmed" | "rejected";
  confirmed_by: string | null;
  confirmed_at: string | null;
  proof_reference: string | null;
  proof_note: string | null;
}

const fmtMoney = (amount: number, currency: string) =>
  currency === "ILS" ? formatILS(amount) : `${amount.toLocaleString("en-US")} ${currency}`;

const CaseFinance: React.FC<Props> = ({ caseId, canManage = false, canConfirm = false }) => {
  const { t, i18n } = useTranslation("dashboard");
  const { toast } = useToast();

  const isArabic = i18n.language?.startsWith("ar");

  const { services, refetch: refetchServices } = useCaseServices(caseId);

  const { financials, refetch: refetchFinancials } = useCaseFinancials(caseId);

  const [agencyConfirmation, setAgencyConfirmation] = useState<FinanceConfirmation | null>(null);

  const [loadingConfirmation, setLoadingConfirmation] = useState(true);

  const [confirmingAgencyFee, setConfirmingAgencyFee] = useState(false);

  const serviceTotal = financials?.service_total ?? 0;

  const paid = financials?.total_confirmed ?? 0;

  const pendingReview = financials?.total_pending_review ?? 0;

  const remaining = financials?.remaining ?? 0;

  const schoolCosts = financials?.school_costs ?? [];

  const schoolSubtotals = useMemo(
    () =>
      schoolCosts.reduce<Record<string, number>>((acc, line) => {
        acc[line.currency] = (acc[line.currency] ?? 0) + Number(line.total || 0);

        return acc;
      }, {}),
    [schoolCosts],
  );

  const lineName = (line: FinancialSchoolLine) =>
    (isArabic ? line.name_ar || line.name_en : line.name_en || line.name_ar) ?? "";

  const status: "unpaid" | "partial" | "settled" =
    serviceTotal <= 0 ? "unpaid" : remaining <= 0 ? "settled" : paid > 0 ? "partial" : "unpaid";

  const statusClass =
    status === "settled"
      ? "bg-emerald-100 text-emerald-800"
      : status === "partial"
        ? "bg-amber-100 text-amber-800"
        : "bg-slate-100 text-slate-800";

  /**
   * Load the new financial confirmation state.
   *
   * This is separate from case_payments.
   *
   * DARB confirmation:
   *   case_finance_confirmations
   *
   * Payment history:
   *   case_payments
   */
  const loadAgencyConfirmation = async () => {
    if (!caseId) return;

    setLoadingConfirmation(true);

    try {
      const { data, error } = await supabase
        .from("case_finance_confirmations")
        .select("status, confirmed_by, confirmed_at, proof_reference, proof_note")
        .eq("case_id", caseId)
        .eq("finance_type", "agency_service_fee")
        .maybeSingle();

      if (error) {
        throw error;
      }

      setAgencyConfirmation(data as FinanceConfirmation | null);
    } catch (error) {
      console.error("Failed to load DARB finance confirmation:", error);

      setAgencyConfirmation(null);
    } finally {
      setLoadingConfirmation(false);
    }
  };

  useEffect(() => {
    loadAgencyConfirmation();
  }, [caseId]);

  /**
   * Confirm the automatically calculated DARB service fee.
   *
   * IMPORTANT:
   *
   * There is intentionally NO amount parameter.
   *
   * The database calculates the amount from case_services.
   *
   * The Team member cannot change the amount.
   */
  const confirmAgencyFee = async () => {
    if (confirmingAgencyFee || agencyConfirmation?.status === "confirmed") {
      return;
    }

    if (serviceTotal <= 0) {
      toast({
        variant: "destructive",
        description: "No DARB services are selected for this case.",
      });

      return;
    }

    setConfirmingAgencyFee(true);

    try {
      const { data, error } = await (supabase as any).rpc("confirm_agency_service_fee", {
        p_case_id: caseId,
      });

      if (error) {
        throw error;
      }

      toast({
        description: `DARB service fee confirmed: ${formatILS(Number(data?.amount_ils ?? serviceTotal))}`,
      });

      await loadAgencyConfirmation();
      await refetchFinancials();
    } catch (error: any) {
      console.error("Failed to confirm DARB service fee:", error);

      toast({
        variant: "destructive",
        description: error?.message || "Unable to confirm the DARB service fee.",
      });
    } finally {
      setConfirmingAgencyFee(false);
    }
  };

  const agencyConfirmed = agencyConfirmation?.status === "confirmed";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              {t("finance.title")}
            </CardTitle>

            <Badge variant="secondary" className={statusClass}>
              {t(`finance.status.${status}`)}
            </Badge>
          </div>

          {financials?.case_reference && (
            <p className="text-sm text-muted-foreground">
              {financials.case_reference}
              {financials.student_name ? ` · ${financials.student_name}` : ""}
            </p>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {/* ================================================== */}
          {/* DARB / AGENCY FINANCE                             */}
          {/* ================================================== */}

          <div className="space-y-3">
            <p className="text-sm font-semibold">{t("finance.summary.agencyBlock")}</p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">{t("finance.summary.services")}</p>

                <p className="mt-1 text-lg font-semibold">{formatILS(serviceTotal)}</p>
              </div>

              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">{t("finance.summary.paid")}</p>

                <p className="mt-1 text-lg font-semibold">{formatILS(paid)}</p>
              </div>

              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">{t("finance.summary.pendingReview")}</p>

                <p className="mt-1 text-lg font-semibold">{formatILS(pendingReview)}</p>
              </div>

              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">{t("finance.summary.remaining")}</p>

                <p
                  className={`mt-1 text-lg font-semibold ${remaining > 0 ? "text-amber-600" : "text-muted-foreground"}`}
                >
                  {formatILS(remaining)}
                </p>
              </div>
            </div>

            {/* ================================================== */}
            {/* DARB CONFIRMATION                                 */}
            {/* ================================================== */}

            <div
              className={`rounded-md border p-4 ${
                agencyConfirmed ? "border-emerald-200 bg-emerald-50/50" : "bg-muted/30"
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {agencyConfirmed ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Clock3 className="h-4 w-4 text-amber-600" />
                    )}

                    <p className="text-sm font-semibold">DARB service fee</p>
                  </div>

                  <p className="mt-1 text-sm font-medium">{formatILS(serviceTotal)}</p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    {agencyConfirmed
                      ? "Confirmed by the assigned Team member."
                      : "Calculated automatically from the selected DARB services. No amount can be entered manually."}
                  </p>

                  {agencyConfirmed && agencyConfirmation?.confirmed_at && (
                    <p className="mt-1 text-xs text-emerald-700">
                      Confirmed {new Date(agencyConfirmation.confirmed_at).toLocaleDateString("en-US")}
                    </p>
                  )}
                </div>

                {canManage && !agencyConfirmed && (
                  <Button
                    type="button"
                    onClick={confirmAgencyFee}
                    disabled={confirmingAgencyFee || loadingConfirmation || serviceTotal <= 0}
                    className="shrink-0 gap-2"
                  >
                    {confirmingAgencyFee && <Loader2 className="h-4 w-4 animate-spin" />}

                    {confirmingAgencyFee ? "Confirming..." : "Confirm DARB Service Fee"}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* ================================================== */}
          {/* GERMANY / SCHOOL COSTS                            */}
          {/* ================================================== */}

          {schoolCosts.length > 0 && (
            <>
              <Separator />

              <div className="space-y-1.5 rounded-md border p-3 text-sm">
                <p className="text-xs font-medium text-muted-foreground">{t("finance.summary.schoolBlock")}</p>

                {schoolCosts.map((line) => (
                  <div key={line.kind} className="space-y-0.5">
                    <div className="flex flex-wrap justify-between gap-2 text-muted-foreground">
                      <span className="min-w-0 break-words">
                        {t(`finance.summary.kind.${line.kind}`)} — {lineName(line)}
                      </span>

                      <span className="whitespace-nowrap font-medium text-foreground">
                        {fmtMoney(line.total, line.currency)}
                      </span>
                    </div>

                    {line.weekly_price ? (
                      <p className="text-xs text-muted-foreground">
                        {fmtMoney(line.weekly_price, line.currency)} × {line.weeks} {t("finance.summary.weeks")} ={" "}
                        {fmtMoney(line.total, line.currency)}
                      </p>
                    ) : null}
                  </div>
                ))}

                {Object.entries(schoolSubtotals).map(([currency, amount]) => (
                  <div key={currency} className="flex justify-between gap-2 border-t pt-1.5 text-sm font-semibold">
                    <span>{t("finance.summary.subtotal")}</span>

                    <span className="whitespace-nowrap">{fmtMoney(amount, currency)}</span>
                  </div>
                ))}

                <p className="text-xs text-muted-foreground">{t("finance.summary.estimateNote")}</p>

                <p className="text-xs text-muted-foreground">{t("finance.summary.noCrossCurrency")}</p>
              </div>
            </>
          )}

          <Separator />

          {/* ================================================== */}
          {/* SERVICES                                           */}
          {/* ================================================== */}

          <CaseServices
            caseId={caseId}
            services={services}
            canManage={canManage}
            onChanged={() => {
              refetchServices();
              refetchFinancials();
              loadAgencyConfirmation();
            }}
          />

          <Separator />

          {/* ================================================== */}
          {/* PAYMENT HISTORY                                    */}
          {/* ================================================== */}

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
