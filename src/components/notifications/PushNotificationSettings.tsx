import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BellRing, Loader2, Send, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  getPushStatus,
  sendTestPush,
  subscribeToPush,
  unsubscribeFromPush,
  type PushStatus,
} from "@/lib/webPush";

const CATEGORIES = [
  "messages",
  "appointments",
  "cases",
  "payments",
  "documents",
  "profile",
  "recruitment",
  "system",
] as const;

type CategoryKey = (typeof CATEGORIES)[number];

interface PreferenceRow {
  user_id: string;
  push_enabled: boolean;
  email_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  [key: string]: unknown;
}

/** Per-device push enrolment plus per-category delivery preferences. */
const PushNotificationSettings: React.FC = () => {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [prefs, setPrefs] = useState<PreferenceRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);

  const loadPreferences = useCallback(async (uid: string) => {
    const { data } = await (supabase as any)
      .from("notification_preferences")
      .select("*")
      .eq("user_id", uid)
      .maybeSingle();
    setPrefs(
      (data as PreferenceRow) ?? {
        user_id: uid,
        push_enabled: true,
        email_enabled: true,
        quiet_hours_start: null,
        quiet_hours_end: null,
        ...Object.fromEntries(CATEGORIES.map((c) => [`cat_${c}`, true])),
      },
    );
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      setUserId(session.user.id);
      setStatus(await getPushStatus());
      await loadPreferences(session.user.id);
    })();
  }, [loadPreferences]);

  const savePreference = async (patch: Record<string, unknown>) => {
    if (!userId || !prefs) return;
    const previous = prefs;
    setPrefs({ ...prefs, ...patch });
    const { error } = await (supabase as any)
      .from("notification_preferences")
      .upsert({ ...prefs, ...patch, user_id: userId }, { onConflict: "user_id" });
    if (error) {
      // Roll back so the switch never shows a state the server rejected.
      setPrefs(previous);
      toast({ variant: "destructive", description: error.message });
    }
  };

  const handleToggleDevice = async (next: boolean) => {
    if (!userId) return;
    setBusy(true);
    try {
      if (next) {
        const result = await subscribeToPush(userId);
        if (!result.ok) {
          toast({
            variant: "destructive",
            description: t(`pushSettings.errors.${result.reason ?? "failed"}`),
          });
        }
      } else {
        await unsubscribeFromPush(userId);
      }
      setStatus(await getPushStatus());
    } finally {
      setBusy(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    const result = await sendTestPush();
    setTesting(false);
    toast({
      variant: result.ok ? "default" : "destructive",
      description: result.ok ? t("pushSettings.testSent") : t("pushSettings.testFailed"),
    });
  };

  const capability = status?.capability;
  const subscribed = Boolean(status?.subscribed && status.permission === "granted");

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <BellRing className="h-5 w-5 text-brand mt-0.5 shrink-0" aria-hidden="true" />
        <div>
          <h3 className="font-semibold text-sm">{t("pushSettings.title")}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{t("pushSettings.subtitle")}</p>
        </div>
      </div>

      {capability === "requires_install" && (
        <Alert>
          <Smartphone className="h-4 w-4" aria-hidden="true" />
          <AlertDescription className="text-xs leading-relaxed">
            {t("pushSettings.iosInstallHint")}
          </AlertDescription>
        </Alert>
      )}

      {capability === "unsupported" && (
        <Alert variant="destructive">
          <AlertDescription className="text-xs">{t("pushSettings.unsupported")}</AlertDescription>
        </Alert>
      )}

      {capability === "supported" && (
        <>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="push-device" className="text-sm font-normal">
              {t("pushSettings.enableOnThisDevice")}
            </Label>
            <div className="flex items-center gap-2">
              {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />}
              <Switch
                id="push-device"
                checked={subscribed}
                disabled={busy || status?.permission === "denied"}
                onCheckedChange={handleToggleDevice}
              />
            </div>
          </div>

          {status?.permission === "denied" && (
            <p className="text-xs text-destructive">{t("pushSettings.errors.denied")}</p>
          )}

          {subscribed && (
            <Button variant="outline" size="sm" onClick={handleTest} disabled={testing} className="w-full">
              {testing ? (
                <Loader2 className="h-4 w-4 me-2 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-4 w-4 me-2" aria-hidden="true" />
              )}
              {t("pushSettings.sendTest")}
            </Button>
          )}
        </>
      )}

      {prefs && (
        <>
          <Separator />
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">{t("pushSettings.categories")}</p>
            {CATEGORIES.map((cat: CategoryKey) => (
              <div key={cat} className="flex items-center justify-between gap-4">
                <Label htmlFor={`cat-${cat}`} className="text-sm font-normal">
                  {t(`pushSettings.category.${cat}`)}
                </Label>
                <Switch
                  id={`cat-${cat}`}
                  checked={prefs[`cat_${cat}`] !== false}
                  onCheckedChange={(v) => savePreference({ [`cat_${cat}`]: v })}
                />
              </div>
            ))}
          </div>

          <Separator />
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">{t("pushSettings.quietHours")}</p>
            <div className="flex items-center gap-2">
              <input
                type="time"
                aria-label={t("pushSettings.quietFrom")}
                value={prefs.quiet_hours_start ?? ""}
                onChange={(e) => savePreference({ quiet_hours_start: e.target.value || null })}
                className="flex-1 h-9 rounded-md border border-input bg-background px-2 text-sm"
              />
              <span className="text-xs text-muted-foreground">—</span>
              <input
                type="time"
                aria-label={t("pushSettings.quietTo")}
                value={prefs.quiet_hours_end ?? ""}
                onChange={(e) => savePreference({ quiet_hours_end: e.target.value || null })}
                className="flex-1 h-9 rounded-md border border-input bg-background px-2 text-sm"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">{t("pushSettings.quietHint")}</p>
          </div>
        </>
      )}
    </div>
  );
};

export default PushNotificationSettings;
