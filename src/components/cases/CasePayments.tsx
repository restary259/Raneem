import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Check, X } from "lucide-react";
import { formatILS } from "@/lib/money";
import type { FinancialPayment, PaymentStatus } from "@/hooks/useCaseFinancials";

interface Props {
  caseId: string;
  payments: FinancialPayment[];

  /**
   * Admin or assigned Team member.
   * Kept for compatibility with the existing CaseFinance component.
   */
  canManage: boolean;

  /**
   * Admin only.
   */
  canConfirm?: boolean;

  onChanged: () => void;
}

const fmtDate = (value: string | null) => (value ? new Date(value).toLocaleDateString("en-US") : "—");

const STATUS_CLASS: Record<PaymentStatus, string> = {
  pending: "bg-slate-100 text-slate-800 border-slate-200",

  submitted: "bg-amber-100 text-amber-800 border-amber-200",

  confirmed: "bg-emerald-100 text-emerald-800 border-emerald-200",

  rejected: "bg-red-100 text-red-800 border-red-200",
};

/**
 * Displays existing payment records.
 *
 * IMPORTANT:
 *
 * DARB service-fee confirmation is no longer handled here.
 *
 * The old workflow allowed Team to enter an arbitrary amount and call
 * submit_case_payment(p_amount).
 *
 * That is intentionally removed.
 *
 * DARB service-fee confirmation now belongs to:
 *
 *     case_finance_confirmations
 *
 * and the secure RPC:
 *
 *     confirm_agency_service_fee(case_id)
 *
 * German-side financial confirmation is handled separately by Admin.
 */
const CasePayments: React.FC<Props> = ({ payments, canConfirm = false, onChanged }) => {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();

  const [busy, setBusy] = useState(false);

  const resolve = async (id: string, confirm: boolean) => {
    if (busy) return;

    setBusy(true);

    try {
      const { error } = await (supabase as any).rpc(
        confirm ? "confirm_case_payment" : "reject_case_payment",
        confirm
          ? {
              p_payment_id: id,
            }
          : {
              p_payment_id: id,
              p_reason: null,
            },
      );

      if (error) {
        throw error;
      }

      toast({
        description: confirm ? t("finance.payments.confirmedToast") : t("finance.payments.rejectedToast"),
      });

      onChanged();
    } catch (error: any) {
      toast({
        variant: "destructive",
        description: error?.message || "Unable to update payment.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* -------------------------------------------------- */}
      {/* Existing payment history                          */}
      {/* -------------------------------------------------- */}

      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{t("finance.payments.title")}</h3>
      </div>

      {payments.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">{t("finance.payments.empty")}</p>
      ) : (
        <div className="space-y-2">
          {payments.map((payment) => (
            <div key={payment.id} className="rounded-md border p-2.5 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{formatILS(payment.amount)}</p>

                  <p className="text-xs text-muted-foreground break-words">
                    {fmtDate(payment.submitted_at ?? payment.created_at)}

                    {payment.note ? ` · ${payment.note}` : ""}
                  </p>

                  {payment.status === "confirmed" && payment.confirmed_at && (
                    <p className="text-xs text-emerald-700">
                      {t("finance.payments.confirmedOn", {
                        date: fmtDate(payment.confirmed_at),
                      })}
                    </p>
                  )}

                  {payment.status === "rejected" && payment.rejected_reason && (
                    <p className="text-xs text-red-700 break-words">{payment.rejected_reason}</p>
                  )}
                </div>

                <Badge variant="secondary" className={`shrink-0 ${STATUS_CLASS[payment.status]}`}>
                  {t(`finance.payments.state.${payment.status}`, payment.status)}
                </Badge>
              </div>

              {/* ------------------------------------------ */}
              {/* Admin payment resolution                  */}
              {/* ------------------------------------------ */}

              {canConfirm && (payment.status === "submitted" || payment.status === "pending") && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="gap-1" disabled={busy} onClick={() => resolve(payment.id, true)}>
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}

                    {t("finance.payments.confirm")}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    disabled={busy}
                    onClick={() => resolve(payment.id, false)}
                  >
                    <X className="h-3.5 w-3.5" />

                    {t("finance.payments.reject")}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Separator />

      {/* -------------------------------------------------- */}
      {/* DARB amount-entry removal notice                  */}
      {/* -------------------------------------------------- */}

      <div className="rounded-md border bg-muted/30 p-3">
        <div className="space-y-1">
          <p className="text-sm font-medium">{t("finance.payments.systemManagedTitle", "DARB service fee")}</p>

          <p className="text-xs text-muted-foreground">
            {t(
              "finance.payments.systemManagedDescription",
              "The DARB service fee is calculated automatically from the selected services. Team members cannot manually enter or change the amount.",
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default CasePayments;
