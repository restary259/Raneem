```tsx
import React from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";
import { formatILS } from "@/lib/money";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type {
  FinancialPayment,
  PaymentStatus,
} from "@/hooks/useCaseFinancials";
import { formatDateNumeric } from "@/utils/dateUtils";

interface Props {
  caseId: string;
  payments: FinancialPayment[];
  canManage: boolean;
  canConfirm?: boolean;
  onChanged: () => void;
}

const STATUS_CLASS: Record<PaymentStatus, string> = {
  pending: "bg-slate-100 text-slate-800 border-slate-200",
  submitted: "bg-amber-100 text-amber-800 border-amber-200",
  confirmed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
};

/**
 * Payment types are intentionally kept separate.
 *
 * agency_service:
 *   DARB service fee.
 *
 * school_course:
 *   Germany language course.
 *
 * school_accommodation:
 *   Germany accommodation.
 *
 * school_insurance:
 *   Germany insurance.
 *
 * IMPORTANT:
 * This component only displays/resolves payment records.
 * It does NOT allow users to manually change payment amounts.
 *
 * DARB service pricing must be determined upstream from the
 * Admin-controlled service catalogue.
 */
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

const paymentDescription = (type: string) => {
  switch (type) {
    case "agency_service":
      return "Calculated from the DARB services selected for this case.";

    case "school_course":
      return "Germany programme / language-school payment.";

    case "school_accommodation":
      return "Germany accommodation payment.";

    case "school_insurance":
      return "Germany insurance payment.";

    default:
      return null;
  }
};

const CasePayments: React.FC<Props> = ({
  caseId,
  payments,
  canManage,
  canConfirm = false,
  onChanged,
}) => {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();

  const [busyId, setBusyId] = React.useState<string | null>(null);

  /**
   * Resolve a submitted/pending payment.
   *
   * The actual financial validation happens server-side inside the RPC.
   * No amount is accepted from the client here.
   */
  const resolve = async (id: string, confirm: boolean) => {
    if (busyId || !canManage) return;

    setBusyId(id);

    try {
      const { error } = await (supabase as any).rpc(
        confirm
          ? "confirm_case_payment"
          : "reject_case_payment",
        confirm
          ? {
              p_payment_id: id,
            }
          : {
              p_payment_id: id,
              p_reason: null,
            },
      );

      if (error) throw error;

      toast({
        description: confirm
          ? t(
              "finance.payments.confirmedToast",
              "Payment confirmed.",
            )
          : t(
              "finance.payments.rejectedToast",
              "Payment rejected.",
            ),
      });

      onChanged();
    } catch (error: any) {
      console.error(
        "Failed to resolve payment:",
        error,
      );

      toast({
        variant: "destructive",
        description:
          error?.message ||
          t(
            "finance.payments.updateFailed",
            "Unable to update payment.",
          ),
      });
    } finally {
      setBusyId(null);
    }
  };

  /**
   * Display a payment amount.
   *
   * DARB agency services are always represented in ILS.
   * Germany payments retain their original currency.
   */
  const renderAmount = (payment: FinancialPayment) => {
    const amount = Number(payment.amount || 0);

    if (payment.currency === "ILS") {
      return formatILS(amount);
    }

    return `${amount.toLocaleString("en-US")} ${payment.currency}`;
  };

  /**
   * Keep DARB service payment visually distinct from Germany payments.
   */
  const isDarbPayment = (payment: FinancialPayment) =>
    payment.payment_type === "agency_service";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">
            {t(
              "finance.payments.title",
              "Payment history",
            )}
          </h3>

          <p className="mt-1 text-xs text-muted-foreground">
            {t(
              "finance.payments.description",
              "All payment amounts are generated from the case financial records and cannot be manually changed here.",
            )}
          </p>
        </div>

        <Badge
          variant="outline"
          className="shrink-0"
        >
          {payments.length}
        </Badge>
      </div>

      {payments.length === 0 ? (
        <div className="rounded-md border border-dashed p-4">
          <p className="text-sm text-muted-foreground">
            {t(
              "finance.payments.empty",
              "No payment records yet.",
            )}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {payments.map((payment) => {
            const isBusy = busyId === payment.id;

            /**
             * Germany payment confirmation is Admin-only.
             *
             * DARB agency payment is handled according to the existing
             * payment workflow and remains server-side validated.
             */
            const adminResolvable =
              canConfirm &&
              payment.payment_type !== "agency_service" &&
              (payment.status === "submitted" ||
                payment.status === "pending");

            const isDarb = isDarbPayment(payment);

            return (
              <div
                key={payment.id}
                className={`space-y-3 rounded-md border p-3 ${
                  isDarb
                    ? "border-primary/20 bg-primary/[0.02]"
                    : "bg-card"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">
                        {paymentLabel(
                          payment.payment_type,
                        )}
                      </p>

                      {isDarb && (
                        <Badge
                          variant="outline"
                          className="text-[10px]"
                        >
                          {t(
                            "finance.payments.darb",
                            "DARB",
                          )}
                        </Badge>
                      )}
                    </div>

                    <p className="text-sm font-semibold">
                      {renderAmount(payment)}
                    </p>

                    {paymentDescription(
                      payment.payment_type,
                    ) && (
                      <p className="text-xs text-muted-foreground">
                        {paymentDescription(
                          payment.payment_type,
                        )}
                      </p>
                    )}

                    <p className="break-words text-xs text-muted-foreground">
                      {formatDateNumeric(
                        payment.submitted_at ??
                          payment.created_at,
                        "—",
                      )}

                      {payment.note
                        ? ` · ${payment.note}`
                        : ""}
                    </p>

                    {payment.status ===
                      "confirmed" &&
                      payment.confirmed_at && (
                        <p className="text-xs text-emerald-700">
                          {t(
                            "finance.payments.confirmedAt",
                            "Confirmed",
                          )}{" "}
                          {formatDateNumeric(
                            payment.confirmed_at,
                            "—",
                          )}
                        </p>
                      )}

                    {payment.status ===
                      "rejected" &&
                      payment.rejected_reason && (
                        <p className="break-words text-xs text-red-700">
                          {payment.rejected_reason}
                        </p>
                      )}
                  </div>

                  <Badge
                    variant="secondary"
                    className={`shrink-0 ${
                      STATUS_CLASS[
                        payment.status
                      ]
                    }`}
                  >
                    {t(
                      `finance.payments.state.${payment.status}`,
                      payment.status,
                    )}
                  </Badge>
                </div>

                {adminResolvable && (
                  <div className="flex flex-wrap gap-2 border-t pt-2">
                    <Button
                      size="sm"
                      className="gap-1"
                      disabled={isBusy}
                      onClick={() =>
                        resolve(
                          payment.id,
                          true,
                        )
                      }
                    >
                      <Check className="h-3.5 w-3.5" />

                      {t(
                        "finance.payments.confirm",
                        "Confirm",
                      )}
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      disabled={isBusy}
                      onClick={() =>
                        resolve(
                          payment.id,
                          false,
                        )
                      }
                    >
                      <X className="h-3.5 w-3.5" />

                      {t(
                        "finance.payments.reject",
                        "Reject",
                      )}
                    </Button>
                  </div>
                )}

                {isDarb &&
                  payment.status ===
                    "confirmed" && (
                    <p className="text-xs text-emerald-700">
                      {t(
                        "finance.payments.darbConfirmed",
                        "DARB service payment confirmed.",
                      )}
                    </p>
                  )}
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-md border border-dashed p-3">
        <p className="text-xs text-muted-foreground">
          {t(
            "finance.payments.businessRule",
            "DARB service fees are calculated from the services selected for the case and priced by the Admin-controlled service catalogue. Team members cannot manually change the DARB service price.",
          )}
        </p>

        <p className="mt-1 text-xs text-muted-foreground">
          {t(
            "finance.payments.germanyRule",
            "Germany course, accommodation, and insurance payments are handled separately and verified by Admin after proof is submitted.",
          )}
        </p>
      </div>
    </div>
  );
};

export default CasePayments;
```
