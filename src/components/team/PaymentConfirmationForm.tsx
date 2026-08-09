import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useCaseFinancials } from "@/hooks/useCaseFinancials";

interface Props {
  caseId: string;
  actorId: string;
  actorName: string;
  onSuccess: () => void;
}

/** Team confirmation for the calculated DARB agency service total. */
export default function PaymentConfirmationForm({ caseId, onSuccess }: Props) {
  const { toast } = useToast();
  const { t } = useTranslation("dashboard");
  const { financials, isLoading, error, refetch } = useCaseFinancials(caseId);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const total = Number(financials?.service_total ?? 0);

  const handleConfirm = async () => {
    if (!confirmed) {
      toast({
        variant: "destructive",
        description: "Please confirm that the DARB agency service fee has been received.",
      });
      return;
    }
    if (total <= 0) {
      toast({ variant: "destructive", description: "Select DARB services before confirming payment." });
      return;
    }

    setSaving(true);
    try {
      const { error: rpcError } = await (supabase as any).rpc("confirm_agency_service_payment", {
        p_case_id: caseId,
      });
      if (rpcError) throw rpcError;

      await refetch();
      toast({ title: t("team.payment.confirmed", "DARB payment confirmed") });
      onSuccess();
    } catch (err: any) {
      console.error("[PaymentConfirmation]", err);
      toast({
        variant: "destructive",
        title: t("common.error"),
        description: err?.message || t("common.actionFailed"),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/30 p-4">
        <p className="text-sm font-medium">DARB agency services</p>
        <p className="mt-1 text-2xl font-bold">{isLoading ? "…" : `${total.toLocaleString("en-US")} ILS`}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          This amount is calculated automatically from the selected DARB services. Team members cannot enter or change
          the amount here.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-start gap-3 rounded-lg border p-3">
        <Checkbox id="darb_payment_received" checked={confirmed} onCheckedChange={(v) => setConfirmed(v === true)} />
        <label htmlFor="darb_payment_received" className="cursor-pointer text-sm leading-tight">
          I confirm that the DARB agency service fee has been received from the student.
        </label>
      </div>

      <Button onClick={handleConfirm} disabled={saving || isLoading || total <= 0 || !confirmed} className="w-full">
        {saving ? (
          <>
            <Loader2 className="me-2 h-4 w-4 animate-spin" />
            Confirming…
          </>
        ) : (
          "Confirm DARB Payment"
        )}
      </Button>
    </div>
  );
}
