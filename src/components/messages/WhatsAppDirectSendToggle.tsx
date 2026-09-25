import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

/** Admin-only switch for Meta Direct Send (service messages only; never marketing). */
export default function WhatsAppDirectSendToggle() {
  const { t } = useTranslation("whatsapp");
  const { toast } = useToast();
  const [row, setRow] = useState<{ id: string; on: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (supabase as any).from("platform_settings").select("id, whatsapp_direct_send_enabled").limit(1).maybeSingle()
      .then(({ data, error }: any) => {
        if (error) { toast({ variant: "destructive", description: t("errors.load") }); return; }
        if (data) setRow({ id: data.id, on: data.whatsapp_direct_send_enabled === true });
      });
  }, [t, toast]);

  const change = async (on: boolean) => {
    if (!row) return;
    setSaving(true);
    const { error } = await (supabase as any).from("platform_settings").update({ whatsapp_direct_send_enabled: on }).eq("id", row.id);
    setSaving(false);
    if (error) { toast({ variant: "destructive", description: t("errors.save") }); return; }
    setRow({ ...row, on });
    toast({ description: on ? t("directSend.enabled") : t("directSend.disabled") });
  };

  return (
    <Card className="flex items-start justify-between gap-3 rounded-xl p-3 shadow-none">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{t("directSend.title")}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{t("directSend.description")}</p>
      </div>
      <Switch checked={row?.on ?? false} disabled={!row || saving} onCheckedChange={(v) => void change(v)} aria-label={t("directSend.title")} />
    </Card>
  );
}
