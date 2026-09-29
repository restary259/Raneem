import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

/**
 * Admin-only master switch for ALL outgoing WhatsApp sending: manual staff
 * sends, scheduled follow-ups and marketing campaigns. Off means nothing
 * leaves the platform; queued campaigns stay queued.
 */
export default function WhatsAppSendingToggle() {
  const { t } = useTranslation("whatsapp");
  const { toast } = useToast();
  const [row, setRow] = useState<{ id: string; on: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (supabase as any)
      .from("platform_settings")
      .select("id, whatsapp_sending_enabled")
      .limit(1)
      .maybeSingle()
      .then(({ data, error }: any) => {
        if (error) {
          toast({ variant: "destructive", description: t("errors.load") });
          return;
        }
        if (data) setRow({ id: data.id, on: data.whatsapp_sending_enabled === true });
      });
  }, [t, toast]);

  const change = async (on: boolean) => {
    if (!row) return;
    setSaving(true);
    const { error } = await (supabase as any)
      .from("platform_settings")
      .update({ whatsapp_sending_enabled: on })
      .eq("id", row.id);
    setSaving(false);
    if (error) {
      toast({ variant: "destructive", description: t("errors.save") });
      return;
    }
    setRow({ ...row, on });
    toast({ description: on ? t("sending.enabled") : t("sending.disabled") });
  };

  return (
    <Card className="flex items-start justify-between gap-3 rounded-lg p-3 shadow-none">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{t("sending.title")}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{t("sending.description")}</p>
        {row && !row.on && (
          <p className="mt-1 text-xs font-medium text-amber-600">{t("sending.offNotice")}</p>
        )}
      </div>
      <Switch
        checked={row?.on ?? false}
        disabled={!row || saving}
        onCheckedChange={(v) => void change(v)}
        aria-label={t("sending.title")}
      />
    </Card>
  );
}
