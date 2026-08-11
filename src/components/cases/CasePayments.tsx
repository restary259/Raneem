import React, { useCallback, useState } from "react";
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

type TranslateFn = (key: string, fallback?: string) => string;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTranslate = TranslateFn | ((...args: any[]) => any);

const paymentLabel = (type: string, t: AnyTranslate): string => {
  return t(
    `finance.payments.labels.${type}`,
    type.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
  );
};

const paymentDescription = (type: string, t: AnyTranslate): string | null => {
  const description = t(`finance.payments.descriptions.${type}`, "");
  return description || null;
};

const CasePayments: React.FC<Props> = ({
  payments,
  canManage,
  canConfirm = false,
  onChanged,
}) => {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();

  const [busyId, setBusyId] = useState<string | null>(null);

  /**
   * Resolve a payment using the server-side RPC.
   *
   * No payment amount is accepted from the client.
   * The RPC is responsible for authorization and financial validation.
   */
  const resolve = useCallback(
    async (paymentId: string, confirm: boolean) => {
      if (busyId || !canManage || !canConfirm) {
        return;
      }

      setBusyId(paymentId);

      try {
        const rpcName = confirm
          ? "confirm_case_payment"
          : "reject_case_payment";

        const rpcArgs = confirm
          ? {
              p_payment_id: paymentId,
            }
          : {
              p_payment_id: paymentId,
              p_reason: null,
            };

        const { error } = await (supabase as any).rpc(
          rpcName,
          rpcArgs,
        );

        if (error) {
          throw error;
        }

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
      } catch (error: unknown) {
        console.error(
          "CasePayments: failed to resolve payment",
          error,
        );

        const message =
          error instanceof Error
            ? error.message
            : typeof error === "object" &&
                error !== null &&
                "message" in error &&
                typeof (error as { message?: unknown }).message ===
                  "string"
              ? String((error as { message: string }).message)
              : t(
                  "finance.payments.updateFailed",
                  "Unable to update payment.",
                );

        toast({
          variant: "destructive",
          description: message,
        });
      } finally {
        setBusyId(null);
      }
    },
    [busyId, canManage, canConfirm, onChanged, t, toast],
  );

  const renderAmount = (payment: FinancialPayment): string => {
    const amount = Number(payment.amount ?? 0);
    const currency = payment.currency ?? "ILS";

    if (currency === "ILS") {
      return formatILS(amount);
    }

    return `${amount.toLocaleString("en-US")} ${currency}`;
  };

  const isDarbPayment = (
    payment: FinancialPayment,
  ): boolean => {
    return payment.payment_type === "agency_service";
  };

  const isGermanyPayment = (
    payment: FinancialPayment,
  ): boolean => {
    return (
      payment.payment_type === "school_course" ||
      payment.payment_type === "school_accommodation" ||
      payment.payment_type === "school_insurance"
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">
            {t(
              "finance.payments.title",
              "Payment history",
            )}
          </h3>

          <p className="mt-1 text-xs text-muted-foreground">
            {t(
              "finance.payments.description",
              "Payment amounts are generated from the case financial records and cannot be manually changed here.",
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

      {/* Empty state */}
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
        <div className="space-y-3">
          {payments.map((payment) => {
            const isBusy = busyId === payment.id;
            const isDarb = isDarbPayment(payment);
            const isGermany = isGermanyPayment(payment);

            /*
             * Only Admin may resolve Germany payments.
             *
             * DARB service payments are intentionally NOT manually
             * confirmed/rejected from this component. Their status
             * comes from the DARB financial workflow.
             */
            const canResolveThisPayment =
              canManage &&
              canConfirm &&
              isGermany &&
              (payment.status === "submitted" ||
                payment.status === "pending");

            const statusClass =
              STATUS_CLASS[payment.status] ??
              "bg-slate-100 text-slate-800 border-slate-200";

            return (
              <div
                key={payment.id}
                className={[
                  "space-y-3 rounded-md border p-3",
                  isDarb
                    ? "border-primary/20 bg-primary/[0.02]"
                    : "bg-card",
                ].join(" ")}
              >
                {/* Payment information */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1.5">
                    {/* Payment type */}
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">
                        {paymentLabel(
                          payment.payment_type,
                          t,
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

                      {isGermany && (
                        <Badge
                          variant="outline"
                          className="text-[10px]"
                        >
                          {t(
                            "finance.payments.germany",
                            "Germany",
                          )}
                        </Badge>
                      )}
                    </div>

                    {/* Amount */}
                    <p className="text-sm font-semibold">
                      {renderAmount(payment)}
                    </p>

                    {/* Description */}
                    {paymentDescription(
                      payment.payment_type,
                      t,
                    ) && (
                      <p className="text-xs text-muted-foreground">
                        {paymentDescription(
                          payment.payment_type,
                          t,
                        )}
                      </p>
                    )}

                    {/* Date / note */}
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

                    {/* Confirmed */}
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

                    {/* Rejected */}
                    {payment.status ===
                      "rejected" &&
                      payment.rejected_reason && (
                        <p className="break-words text-xs text-red-700">
                          {t(
                            "finance.payments.rejectedReason",
                            "Reason",
                          )}
                          :{" "}
                          {payment.rejected_reason}
                        </p>
                      )}
                  </div>

                  {/* Status */}
                  <Badge
                    variant="secondary"
                    className={`shrink-0 border ${statusClass}`}
                  >
                    {t(
                      `finance.payments.state.${payment.status}`,
                      payment.status,
                    )}
                  </Badge>
                </div>

                {/* Admin actions */}
                {canResolveThisPayment && (
                  <div className="flex flex-wrap gap-2 border-t pt-3">
                    <Button
                      type="button"
                      size="sm"
                      className="gap-1"
                      disabled={isBusy}
                      onClick={() =>
                        void resolve(
                          payment.id,
                          true,
                        )
                      }
                    >
                      <Check className="h-3.5 w-3.5" />

                      {isBusy
                        ? t(
                            "finance.payments.processing",
                            "Processing...",
                          )
                        : t(
                            "finance.payments.confirm",
                            "Confirm",
                          )}
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      disabled={isBusy}
                      onClick={() =>
                        void resolve(
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

                {/* DARB information */}
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

                {isDarb &&
                  payment.status !==
                    "confirmed" && (
                    <p className="text-xs text-muted-foreground">
                      {t(
                        "finance.payments.darbCalculated",
                        "DARB service pricing is calculated from the services selected for this case and the Admin-controlled service catalogue.",
                      )}
                    </p>
                  )}
              </div>
            );
          })}
        </div>
      )}

      {/* Business rules live once, as consolidated notes in CaseFinance. */}
    </div>
  );
};

export default CasePayments;
