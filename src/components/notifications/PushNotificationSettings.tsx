import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BellRing, Info, Loader2, Send, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  getPushDiagnostics,
  getPushStatus,
  sendTestPush,
  subscribeToPush,
  unsubscribeFromPush,
  type PushDiagnostics,
  type PushStatus,
} from "@/lib/webPush";
import {
  categoriesForRole,
  NOTIFICATION_CATEGORIES,
} from "@/lib/notificationCategories";
import type { AppRole } from "@/contexts/AuthContext";

interface PreferenceRow {
  user_id: string;
  push_enabled: boolean;
  email_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  [key: string]: unknown;
}

/** Per-device push enrolment plus per-category delivery preferences. */
const PushNotificationSettings: React.FC<{ role: AppRole }> = ({ role }) => {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [prefs, setPrefs] = useState<PreferenceRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [diagnostics, setDiagnostics] = useState<PushDiagnostics | null>(null);

  // Only the categories this role can actually receive are rendered; the rest
  // keep whatever value is already saved.
  const categories = categoriesForRole(role);

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
        ...Object.fromEntries(
          NOTIFICATION_CATEGORIES.map((c) => [c.column, true]),
        ),
      },
    );
  }, []);

  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) return;
      setUserId(session.user.id);
      setStatus(await getPushStatus());
      await loadPreferences(session.user.id);
      setDiagnostics(await getPushDiagnostics());
    })();
  }, [loadPreferences]);

  const savePreference = async (patch: Record<string, unknown>) => {
    if (!userId || !prefs) return;
    const previous = prefs;
    setPrefs({ ...prefs, ...patch });
    const { error } = await (supabase as any)
      .from("notification_preferences")
      .upsert(
        { ...prefs, ...patch, user_id: userId },
        { onConflict: "user_id" },
      );
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
      setDiagnostics(await getPushDiagnostics());
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
      description: result.ok
        ? t("pushSettings.testSent")
        : t("pushSettings.testFailed"),
    });
    setDiagnostics(await getPushDiagnostics());
  };

  const capability = status?.capability;
  const subscribed = Boolean(
    status?.subscribed && status.permission === "granted",
  );

  const diagnosticRows: Array<[string, string]> = diagnostics
    ? [
        ["capability", diagnostics.capability],
        ["permission", String(diagnostics.permission)],
        ["device", `${diagnostics.platform} · ${diagnostics.browser}`],
        ["installed", diagnostics.standalone ? "yes" : "no"],
        ["origin", diagnostics.origin],
        [
          "worker",
          diagnostics.swState
            ? `${diagnostics.swState} (${diagnostics.swScope})`
            : "none",
        ],
        ["endpoint", diagnostics.endpointHost ?? "none"],
        [
          "stored",
          diagnostics.storedActive === null
            ? "none"
            : diagnostics.storedActive
              ? "active"
              : "inactive",
        ],
        ["lastSuccess", diagnostics.lastSuccessAt ?? "—"],
        [
          "lastError",
          diagnostics.lastErrorStatus
            ? String(diagnostics.lastErrorStatus)
            : "—",
        ],
      ]
    : [];

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <BellRing
          className="h-5 w-5 text-brand mt-0.5 shrink-0"
          aria-hidden="true"
        />
        <div>
          <h3 className="font-semibold text-sm">{t("pushSettings.title")}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("pushSettings.subtitle")}
          </p>
        </div>
      </div>

      {diagnostics && (
        <div className="rounded-lg border border-border p-3 text-xs space-y-1">
          <p className="font-semibold text-sm">{t("pushSettings.device.title")}</p>
          <p className="text-muted-foreground">
            {diagnostics.platform} · {diagnostics.browser}
          </p>
          <p>
            {t("pushSettings.device.installed")}:{" "}
            {diagnostics.standalone ? t("pushSettings.device.yes") : t("pushSettings.device.no")}
          </p>
          <p>
            {t("pushSettings.device.status")}:{" "}
            {diagnostics.permission === "denied"
              ? t("pushSettings.device.blocked")
              : diagnostics.permission === "granted" && diagnostics.storedActive
                ? t("pushSettings.device.enabled")
                : t("pushSettings.device.off")}
          </p>
          <p>
            {t("pushSettings.device.lastDelivery")}:{" "}
            {diagnostics.lastSuccessAt
              ? new Date(diagnostics.lastSuccessAt).toLocaleString("en-US")
              : "—"}
          </p>
        </div>
      )}

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
          <AlertDescription className="text-xs">
            {t("pushSettings.unsupported")}
          </AlertDescription>
        </Alert>
      )}

      {capability === "supported" && (
        <>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="push-device" className="text-sm font-normal">
              {t("pushSettings.enableOnThisDevice")}
            </Label>
            <div className="flex items-center gap-2">
              {busy && (
                <Loader2
                  className="h-4 w-4 animate-spin text-muted-foreground"
                  aria-hidden="true"
                />
              )}
              <Switch
                id="push-device"
                checked={subscribed}
                disabled={busy || status?.permission === "denied"}
                onCheckedChange={handleToggleDevice}
              />
            </div>
          </div>

          {status?.permission === "denied" && (
            <p className="text-xs text-destructive">
              {t("pushSettings.errors.denied")}
            </p>
          )}

          {subscribed && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={testing}
              className="w-full"
            >
              {testing ? (
                <Loader2
                  className="h-4 w-4 me-2 animate-spin"
                  aria-hidden="true"
                />
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
            <p className="text-xs font-medium text-muted-foreground">
              {t("pushSettings.categories")}
            </p>
            {categories.map((cat) => (
              <div
                key={cat.key}
                className="flex items-center justify-between gap-4"
              >
                <div className="space-y-0.5">
                  <Label
                    htmlFor={`cat-${cat.key}`}
                    className="text-sm font-normal"
                  >
                    {t(`pushSettings.categoryRole.${role}.${cat.key}`, {
                      defaultValue: t(`pushSettings.category.${cat.key}`),
                    })}
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    {t(`pushSettings.categoryRoleDesc.${role}.${cat.key}`, {
                      defaultValue: t(`pushSettings.categoryDesc.${cat.key}`),
                    })}
                  </p>
                </div>
                <Switch
                  id={`cat-${cat.key}`}
                  checked={prefs[cat.column] !== false}
                  onCheckedChange={(v) => savePreference({ [cat.column]: v })}
                />
              </div>
            ))}
          </div>

          <Separator />
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              {t("pushSettings.quietHours")}
            </p>
            <div className="flex items-center gap-2">
              <input
                type="time"
                aria-label={t("pushSettings.quietFrom")}
                value={prefs.quiet_hours_start ?? ""}
                onChange={(e) =>
                  savePreference({ quiet_hours_start: e.target.value || null })
                }
                className="flex-1 h-9 rounded-md border border-input bg-background px-2 text-sm"
              />
              <span className="text-xs text-muted-foreground">—</span>
              <input
                type="time"
                aria-label={t("pushSettings.quietTo")}
                value={prefs.quiet_hours_end ?? ""}
                onChange={(e) =>
                  savePreference({ quiet_hours_end: e.target.value || null })
                }
                className="flex-1 h-9 rounded-md border border-input bg-background px-2 text-sm"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {t("pushSettings.quietHint")}
            </p>
          </div>
        </>
      )}

      <Separator />
      <details className="group">
        <summary className="text-xs font-medium text-muted-foreground cursor-pointer list-none flex items-center gap-1">
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
          {t("pushSettings.diagnostics.title")}
        </summary>
        <dl className="mt-2 space-y-1 text-[11px] text-muted-foreground">
          {diagnostics ? (
            diagnosticRows.map(([label, value]) => (
              <div
                key={label}
                className="flex items-start justify-between gap-3"
              >
                <dt>{t(`pushSettings.diagnostics.${label}`)}</dt>
                <dd className="font-mono text-foreground/80 break-all text-end">
                  {value}
                </dd>
              </div>
            ))
          ) : (
            <p>{t("pushSettings.diagnostics.loading")}</p>
          )}
        </dl>
      </details>
    </div>
  );
};

export default PushNotificationSettings;
