import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Handshake, Loader2 } from "lucide-react";
import { toneClasses } from "@/lib/statusTokens";

const fmt = (n: number) => `₪${Number(n || 0).toLocaleString("en-US")}`;

interface Offer {
  id: string;
  master_name: string | null;
  partner_id: string;
  pool_amount: number;
  partner_amount: number;
  master_amount: number;
  version: number;
  status: string;
  note: string | null;
  offered_at: string;
}

/** Pending rate offers addressed to the signed-in partner: accept or decline. */
export default function RateOfferInbox({ onChanged }: { onChanged?: () => void }) {
  const { t, i18n } = useTranslation("dashboard");
  const { user } = useAuth();
  const { toast } = useToast();
  const locale = i18n.language === "ar" ? "ar" : "en-US";
  const [offers, setOffers] = useState<Offer[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await (supabase as any).rpc("get_my_rate_offers");
    const rows = ((data || []) as Offer[]).filter(
      (o) => o.status === "pending" && o.partner_id === user.id,
    );
    setOffers(rows);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const respond = async (id: string, accept: boolean) => {
    setBusy(id);
    const { error } = await (supabase as any).rpc("partner_respond_rate_offer", {
      p_offer_id: id,
      p_accept: accept,
    });
    setBusy(null);
    if (error) {
      toast({ variant: "destructive", title: t("common.actionFailed", "Action failed"), description: error.message });
      return;
    }
    toast({
      title: accept
        ? t("master.offerAccepted", "Offer accepted")
        : t("master.offerDeclined", "Offer declined"),
    });
    await load();
    onChanged?.();
  };

  if (offers.length === 0) return null;

  return (
    <div className="space-y-3">
      {offers.map((o) => (
        <Card key={o.id} className={`border-[hsl(var(--status-payment)/0.4)] ${toneClasses("payment").tint}`}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Handshake className={`h-4 w-4 ${toneClasses("payment").text}`} />
              {t("master.offerInboxTitle", "Commission agreement offer")}
              <span className="text-xs font-normal text-muted-foreground">
                v{o.version} · {new Date(o.offered_at).toLocaleDateString(locale)}
              </span>
            </div>
            <p className="text-sm">
              {t("master.offerInboxBody", "{{name}} proposes that you receive {{amount}} per paid case instead of {{pool}}.", {
                name: o.master_name ?? "",
                amount: fmt(o.partner_amount),
                pool: fmt(o.pool_amount),
              })}
            </p>
            {o.note && <p className="text-xs text-muted-foreground italic">“{o.note}”</p>}
            <div className="flex gap-2">
              <Button size="sm" disabled={busy === o.id} onClick={() => respond(o.id, true)}>
                {busy === o.id && <Loader2 className="h-3.5 w-3.5 animate-spin me-1.5" />}
                {t("master.offerAccept", "Accept")}
              </Button>
              <Button size="sm" variant="outline" disabled={busy === o.id} onClick={() => respond(o.id, false)}>
                {t("master.offerDecline", "Decline")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
