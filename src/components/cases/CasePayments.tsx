import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Loader2, Trash2 } from "lucide-react";
import { formatILS } from "@/lib/money";
import type { CasePayment } from "@/hooks/useCasePayments";

interface Props {
  caseId: string;
  payments: CasePayment[];
  canManage: boolean;
  onChanged: () => void;
}

const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleDateString("en-US") : "—");

const CasePayments: React.FC<Props> = ({ caseId, payments, canManage, onChanged }) => {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");

  const reset = () => {
    setAmount("");
    setNote("");
    setDate(new Date().toISOString().slice(0, 10));
    setAdding(false);
  };

  const record = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast({ variant: "destructive", description: t("finance.payments.invalidAmount") });
      return;
    }
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("case_payments").insert({
        case_id: caseId,
        payment_type: "service_fee",
        amount: value,
        paid_status: "paid",
        paid_date: new Date(date).toISOString(),
        note: note.trim() || null,
        recorded_by: auth?.user?.id ?? null,
      });
      if (error) throw error;
      toast({ description: t("finance.payments.recorded") });
      reset();
      onChanged();
    } catch (e: any) {
      toast({ variant: "destructive", description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      const { error } = await (supabase as any).from("case_payments").delete().eq("id", id);
      if (error) throw error;
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
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-md border p-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{formatILS(p.amount)}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {fmtDate(p.paid_date)}
                  {p.note ? ` · ${p.note}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge
                  variant="secondary"
                  className={
                    p.paid_status === "paid"
                      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                      : ""
                  }
                >
                  {t(`finance.payments.status.${p.paid_status}`, p.paid_status)}
                </Badge>
                {canManage && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    disabled={busy}
                    onClick={() => remove(p.id)}
                    aria-label={t("finance.payments.remove")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {canManage && adding && (
        <>
          <Separator />
          <div className="space-y-3 rounded-md border p-3 bg-muted/30">
            <div className="grid grid-cols-2 gap-2">
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
                <Label className="text-xs">{t("finance.payments.date")}</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("finance.payments.note")}</Label>
              <Input value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={record} disabled={busy} className="gap-1">
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
