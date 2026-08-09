import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BellRing, Loader2, Smartphone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getPushStatus, subscribeToPush, type PushStatus } from "@/lib/webPush";

/**
 * First-login prompt that explains why notifications matter and enables them
 * from a real user gesture (required by browsers, especially iOS PWAs).
 * Shown once per account: the outcome is stored on the profile.
 */
export default function NotificationOnboardingDialog() {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();
  const { user, role } = useAuth();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) return;
      const { data } = await (supabase as any)
        .from("profiles")
        .select("push_onboarding_state")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data?.push_onboarding_state && data.push_onboarding_state !== "not_seen") return;

      const s = await getPushStatus();
      if (cancelled) return;
      setStatus(s);
      // Nothing to ask when the device already granted or actively blocked it.
      if (s.permission === "granted" || s.permission === "denied") {
        await saveState(s.permission === "granted" ? "enabled" : "blocked");
        return;
      }
      setOpen(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const saveState = async (state: string) => {
    if (!user?.id) return;
    await (supabase as any)
      .from("profiles")
      .update({ push_onboarding_state: state, push_onboarding_updated_at: new Date().toISOString() })
      .eq("id", user.id);
  };

  const handleEnable = async () => {
    if (!user?.id) return;
    setBusy(true);
    const result = await subscribeToPush(user.id);
    setBusy(false);
    if (result.ok) {
      await saveState("enabled");
      toast({ description: t("pushOnboarding.enabled") });
      setOpen(false);
    } else {
      await saveState(result.reason === "denied" ? "blocked" : "failed");
      toast({
        variant: "destructive",
        description: t(`pushSettings.errors.${result.reason ?? "failed"}`),
      });
      setOpen(false);
    }
  };

  const handleLater = async () => {
    await saveState("dismissed");
    setOpen(false);
  };

  const roleKey =
    role === "admin" || role === "team_member"
      ? "staff"
      : role === "social_media_partner" || role === "ambassador"
        ? "partner"
        : "student";

  const needsInstall = status?.capability === "requires_install";

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : handleLater())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-primary" />
            {t("pushOnboarding.title")}
          </DialogTitle>
          <DialogDescription>{t(`pushOnboarding.body.${roleKey}`)}</DialogDescription>
        </DialogHeader>

        {needsInstall && (
          <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
            <Smartphone className="mt-0.5 h-4 w-4 shrink-0" />
            {t("pushOnboarding.installHint")}
          </p>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={handleLater} disabled={busy}>
            {t("pushOnboarding.later")}
          </Button>
          <Button onClick={handleEnable} disabled={busy || needsInstall}>
            {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("pushOnboarding.enable")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
