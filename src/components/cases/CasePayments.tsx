import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";
import { formatILS } from "@/lib/money";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { FinancialPayment, PaymentStatus } from "@/hooks/useCaseFinancials";

interface Props {
  caseId: string;
  payments: FinancialPayment[];
  canManage: boolean;
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

const paymentLabel = (type: string) => {
  switch (type) {
    case "agency_service":
      return "DARB agency services";
    case "school_course":
      return "Germany · Language course";
    case "school_accommodation":
      return "Germany · Accommodation";
    case "school_insurance":
      return "Germany · Insurance";
    default:
      return type.split("_").join(" ");
  }
};

const CasePayments: React.FC<Props> = ({ payments, canConfirm = false, onChanged }) => {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const resolve = async (id: string, confirm: boolean) => {
    if (busyId) return;
    setBusyId(id);
    try {
      const { error } = await (supabase as any).rpc(
        confirm ? "confirm_case_payment" : "reject_case_payment",
        confirm ? { p_payment_id: id } : { p_payment_id: id, p_reason: null },
      );
      if (error) throw error;
      toast({
        description: confirm
          ? t("finance.payments.confirmedToast", "Payment confirmed.")
          : t("finance.payments.rejectedToast", "Payment rejected."),
      });
      onChanged();
    } catch (error: any) {
      console.error("Failed to resolve payment:", error);
      toast({ variant: "destructive", description: error?.message || "Unable to update payment." });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">{t("finance.payments.title", "Payment history")}</p>
      </div>

      {payments.length === 0 ? (
        <div className="rounded-md border border-dashed p-4">
          <p className="text-sm text-muted-foreground">{t("finance.payments.empty", "No payment records yet.")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {payments.map((payment) => {
            const isBusy = busyId === payment.id;
            const adminResolvable =
              canConfirm &&
              payment.payment_type !== "agency_service" &&
              (payment.status === "submitted" || payment.status === "pending");
            return (
              <div key={payment.id} className="space-y-2 rounded-md border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{paymentLabel(payment.payment_type)}</p>
                    <p className="mt-0.5 text-sm font-semibold">
                      {payment.currency === "ILS"
                        ? formatILS(Number(payment.amount || 0))
                        : `${Number(payment.amount || 0).toLocaleString("en-US")} ${payment.currency}`}
                    </p>
                    <p className="break-words text-xs text-muted-foreground">
                      {fmtDate(payment.submitted_at ?? payment.created_at)}
                      {payment.note ? ` · ${payment.note}` : ""}
                    </p>
                    {payment.status === "confirmed" && payment.confirmed_at && (
                      <p className="text-xs text-emerald-700">Confirmed {fmtDate(payment.confirmed_at)}</p>
                    )}
                    {payment.status === "rejected" && payment.rejected_reason && (
                      <p className="break-words text-xs text-red-700">{payment.rejected_reason}</p>
                    )}
                  </div>
                  <Badge variant="secondary" className={`shrink-0 ${STATUS_CLASS[payment.status]}`}>
                    {t(`finance.payments.state.${payment.status}`, payment.status)}
                  </Badge>
                </div>

                {adminResolvable && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" className="gap-1" disabled={isBusy} onClick={() => resolve(payment.id, true)}>
                      <Check className="h-3.5 w-3.5" /> Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      disabled={isBusy}
                      onClick={() => resolve(payment.id, false)}
                    >
                      <X className="h-3.5 w-3.5" /> Reject
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        DARB service fees are calculated from selected services and confirmed by the assigned Team member. Germany
        payments are verified separately by Admin after proof is submitted.
      </p>
    </div>
  );
};

export default CasePayments;
