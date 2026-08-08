import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, SlidersHorizontal } from "lucide-react";

const fmt = (n: number) => `₪${Number(n || 0).toLocaleString("en-US")}`;

interface Props {
  partnerId: string;
  partnerName: string;
  poolAmount: number;
  currentPartnerAmount: number;
  onSent: () => void;
}

/** Master partner directly sets the per-case rate for a partner he recruited.
 *  Terms are agreed offline in the signed contract, so no approval round-trip. */
export default function RateOfferDialog({
  partnerId, partnerName, poolAmount, currentPartnerAmount, onSent,
}: Props) {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(currentPartnerAmount));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const value = Number(amount);
  const valid = Number.isFinite(value) && value >= 0 && value <= poolAmount;
  const masterShare = valid ? poolAmount - value : 0;

  const send = async () => {
    if (!valid || saving) return;
    setSaving(true);
    const { error } = await (supabase as any).rpc("master_send_rate_offer", {
      p_partner_id: partnerId,
      p_partner_amount: Math.round(value),
      p_note: note || null,
    });
    setSaving(false);
    if (error) {
      toast({ variant: "destructive", title: t("common.actionFailed", "Action failed"), description: error.message });
      return;
    }
    setOpen(false);
    setNote("");
    toast({ title: t("master.rateApplied", "Rate updated") });
    onSent();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {t("master.setRate", "Set rate")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("master.rateTitle", "Set partner rate")} — {partnerName}</DialogTitle>
          <DialogDescription>
            {t("master.rateDesc", "This rate applies immediately to future cases, per your signed agreement. Darb's total cost per case does not change.")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rate-amount">{t("master.offerAmount", "Partner receives per case")}</Label>
            <Input
              id="rate-amount"
              type="number"
              min={0}
              max={poolAmount}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t("master.offerPool", "Pool")}: {fmt(poolAmount)}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span>{t("master.offerPartnerGets", "Partner gets")}</span>
              <span className="font-semibold">{fmt(valid ? value : 0)}</span>
            </div>
            <div className="flex justify-between">
              <span>{t("master.offerYouGet", "You get (difference)")}</span>
              <span className="font-semibold">{fmt(masterShare)}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t border-border">
              <span>{t("master.offerDarbCost", "Darb pays (unchanged)")}</span>
              <span>{fmt(poolAmount)}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rate-note">{t("master.offerNote", "Note (optional)")}</Label>
            <Textarea id="rate-note" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>{t("common.cancel", "Cancel")}</Button>
          <Button onClick={send} disabled={!valid || saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin me-2" />}
            {t("master.rateSave", "Apply rate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
