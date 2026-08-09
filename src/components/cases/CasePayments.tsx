import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Loader2, Check, X } from "lucide-react";
import { formatILS } from "@/lib/money";
import type { FinancialPayment, PaymentStatus } from "@/hooks/useCaseFinancials";

interface Props {
  caseId: string;
  payments: FinancialPayment[];
  /** Admin or the assigned team member — may submit a received payment. */
  canManage: boolean;
  /** Admin only — may confirm or reject a submitted payment. */
  canConfirm?: boolean;
  onChanged: () => void;
}

const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleDateString("en-US") : "—");

const STATUS_CLASS: Record<PaymentStatus, string> = {
  pending: "bg-slate-100 text-slate-800 border-slate-200",
  submitted: "bg-amber-100 text-amber-800 border-amber-200",
  confirmed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
};

/**
 * Payment lifecycle UI. The team submits what it received; only an admin can
 * confirm it, and the amount that gets stored is decided by the server.
 */
const CasePayments: React.FC<Props> = ({
  caseId,
  payments,
  canManage,
  canConfirm = false,
  onChanged,
}) => {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const reset = () => {
    setAmount("");
    setNote("");
    setAdding(false);
  };

  const submitPayment = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast({ variant: "destructive", description: t("finance.payments.invalidAmount") });
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await (supabase as any).rpc("submit_case_payment", {
        p_case_id: caseId,
        p_amount: value,
        p_note: note.trim() || null,
        // Same key for a repeated click on the same amount → no duplicate row.
        p_idem_key: `manual:${caseId}:${value}:${note.trim()}`,
        p_payment_type: "service_fee",
      });
      if (error) throw error;
      toast({ description: t("finance.payments.submitted") });
      reset();
      onChanged();
    } catch (e: any) {
      toast({ variant: "destructive", description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  const resolve = async (id: string, confirm: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await (supabase as any).rpc(
        confirm ? "confirm_case_payment" : "reject_case_payment",
        confirm ? { p_payment_id: id } : { p_payment_id: id, p_reason: null },
      );
      if (error) throw error;
      toast({
        description: confirm
          ? t("finance.payments.confirmedToast")
          : t("finance.payments.rejectedToast"),
      });
      onChanged();
    } catch (e: any) {
      toast({ variant: "destructive", description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t("finance.payments.title")}</h3>
        {canManage && !adding && (
          <Button size="sm" variant="outline" className="gap-1" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" />
            {t("finance.payments.add")}
          </Button>
        )}
      </div>

      {payments.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">{t("finance.payments.empty")}</p>
      ) : (
        <div className="space-y-2">
          {payments.map((p) => (
            <div key={p.id} className="rounded-md border p-2.5 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{formatILS(p.amount)}</p>
                  <p className="text-xs text-muted-foreground break-words">
                    {fmtDate(p.submitted_at ?? p.created_at)}
                    {p.note ? ` · ${p.note}` : ""}
                  </p>
                  {p.status === "confirmed" && p.confirmed_at && (
                    <p className="text-xs text-emerald-700">
                      {t("finance.payments.confirmedOn", { date: fmtDate(p.confirmed_at) })}
                    </p>
                  )}
                  {p.status === "rejected" && p.rejected_reason && (
                    <p className="text-xs text-red-700 break-words">{p.rejected_reason}</p>
                  )}
                </div>
                <Badge variant="secondary" className={`shrink-0 ${STATUS_CLASS[p.status]}`}>
                  {t(`finance.payments.state.${p.status}`, p.status)}
                </Badge>
              </div>

              {canConfirm && (p.status === "submitted" || p.status === "pending") && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="gap-1"
                    disabled={busy}
                    onClick={() => resolve(p.id, true)}
                  >
                    <Check className="h-3.5 w-3.5" />
                    {t("finance.payments.confirm")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    disabled={busy}
                    onClick={() => resolve(p.id, false)}
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

      {canManage && adding && (
        <>
          <Separator />
          <div className="space-y-3 rounded-md border p-3 bg-muted/30">
            <div className="space-y-1">
              <Label className="text-xs">{t("finance.payments.amount")}</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("finance.payments.note")}</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground">{t("finance.payments.submitHint")}</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={submitPayment} disabled={busy} className="gap-1">
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {t("finance.payments.save")}
              </Button>
              <Button size="sm" variant="ghost" onClick={reset} disabled={busy}>
                {t("common.cancel")}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CasePayments;
