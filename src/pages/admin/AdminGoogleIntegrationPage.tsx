import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  RotateCcw,
  Zap,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  adminGoogleAttentionOffices,
  adminGoogleIntegrationHealth,
  adminGoogleEventTimeline,
  adminListGoogleDeadLetters,
  adminRetryGoogleEvent,
  adminUpdateGooglePubSubConfig,
  getGoogleNotificationTypes,
  type AdminAttentionOffice,
  type AdminDeadLetterRow,
  type AdminEventTimelineRow,
  type AdminIntegrationHealth,
} from "@/lib/googleBusinessRealtime.functions";
import { Input } from "@/components/ui/input";

/**
 * Phase 9 — the Admin Google operations page.
 *
 * This is where the account-level integration lives (connection, Pub/Sub,
 * event processing, failures). It is deliberately separate from an office page:
 * Google's notification setting is per-account, so per-office configuration
 * would be misleading.
 *
 * Reads go through the admin-gated server functions; the browser never touches
 * the raw event table directly. Realtime only triggers a re-read.
 */

const HEALTH_DOT: Record<string, string> = {
  HEALTHY: "bg-emerald-500",
  ATTENTION: "bg-amber-500",
  ACTION_REQUIRED: "bg-destructive",
  UNAVAILABLE: "bg-destructive",
  UNKNOWN: "bg-muted-foreground",
};

function formatTime(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function AdminGoogleIntegrationPage() {
  const { t } = useTranslation("dashboard");
  const [health, setHealth] = useState<AdminIntegrationHealth | null>(null);
  const [attention, setAttention] = useState<AdminAttentionOffice[]>([]);
  const [events, setEvents] = useState<AdminEventTimelineRow[]>([]);
  const [deadLetters, setDeadLetters] = useState<AdminDeadLetterRow[]>([]);
  const [supportedTypes, setSupportedTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [topicDraft, setTopicDraft] = useState("");
  const [subscriptionDraft, setSubscriptionDraft] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [h, a, e, d, types] = await Promise.all([
        adminGoogleIntegrationHealth(),
        adminGoogleAttentionOffices(),
        adminGoogleEventTimeline({ data: { limit: 25 } }),
        adminListGoogleDeadLetters({ data: { limit: 25 } }),
        getGoogleNotificationTypes(),
      ]);
      setHealth(h);
      setAttention(a);
      setEvents(e);
      setDeadLetters(d);
      setSupportedTypes(types.supported);
      setTopicDraft((cur) => cur || (h?.pubsubTopic ?? ""));
      setSubscriptionDraft((cur) => cur || (h?.pubsubSubscription ?? ""));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("googleIntegration.loadError"),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live re-read when jobs or health change; the browser never listens to Google.
  useEffect(() => {
    const channel = supabase
      .channel("google-business-integration")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "google_business_sync_jobs" },
        () => void load(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "google_business_location_health",
        },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const retry = useCallback(
    async (eventId: string) => {
      setBusy(true);
      try {
        await adminRetryGoogleEvent({ data: { eventId } });
        await load();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t("googleIntegration.actionFailed"),
        );
      } finally {
        setBusy(false);
      }
    },
    [load, t],
  );

  const saveConfig = useCallback(async () => {
    if (!health?.connectionId) return;
    setBusy(true);
    try {
      await adminUpdateGooglePubSubConfig({
        data: {
          connectionId: health.connectionId,
          topic: topicDraft.trim() || null,
          subscription: subscriptionDraft.trim() || null,
          status: topicDraft.trim() ? "connected" : "not_configured",
          notificationTypes: supportedTypes,
        },
      });
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("googleIntegration.actionFailed"),
      );
    } finally {
      setBusy(false);
    }
  }, [
    health?.connectionId,
    topicDraft,
    subscriptionDraft,
    supportedTypes,
    load,
    t,
  ]);

  const status = health?.pubsubStatus ?? "not_configured";
  const statusLabel =
    status === "connected"
      ? t("googleIntegration.connected")
      : status === "misconfigured"
        ? t("googleIntegration.misconfigured")
        : status === "error"
          ? t("googleIntegration.failing")
          : t("googleIntegration.notConnected");

  return (
    <div
      className="mx-auto w-full max-w-5xl space-y-6 p-4"
      data-testid="admin-google-integration"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {t("googleIntegration.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("googleIntegration.subtitle")}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading || busy}
        >
          <RefreshCw className="me-2 h-4 w-4" />
          {t("googleIntegration.refresh")}
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {loading && !health ? (
        <p className="text-sm text-muted-foreground">
          {t("googleIntegration.loading")}
        </p>
      ) : null}

      {health ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">
              {t("googleIntegration.connection")}
            </CardTitle>
            <Badge variant={status === "connected" ? "default" : "destructive"}>
              <span
                className={`me-2 inline-block h-2 w-2 rounded-full ${status === "connected" ? "bg-emerald-500" : "bg-destructive"}`}
              />
              {statusLabel}
            </Badge>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <div className="text-muted-foreground">
                {t("googleIntegration.oauth")}
              </div>
              <div>{health.connectionStatus}</div>
            </div>
            <div>
              <div className="text-muted-foreground">
                {t("googleIntegration.pubsub")}
              </div>
              <div>{statusLabel}</div>
            </div>
            <div className="min-w-0">
              <div className="text-muted-foreground">
                {t("googleIntegration.topic")}
              </div>
              <div className="truncate font-mono text-xs">
                {health.pubsubTopic ?? "—"}
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-muted-foreground">
                {t("googleIntegration.subscription")}
              </div>
              <div className="truncate font-mono text-xs">
                {health.pubsubSubscription ?? "—"}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">
                {t("googleIntegration.lastEventReceived")}
              </div>
              <div>{formatTime(health.lastEventReceivedAt)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">
                {t("googleIntegration.lastEventProcessed")}
              </div>
              <div>{formatTime(health.lastEventProcessedAt)}</div>
            </div>
            <div className="sm:col-span-2 text-xs text-muted-foreground">
              {t("googleIntegration.oneTopicHint")}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {health ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-semibold">
                {health.mappedOffices}
              </div>
              <div className="text-sm text-muted-foreground">
                {t("googleIntegration.mappedOffices")}
              </div>
              <div className="text-xs text-muted-foreground">
                {health.healthyMappings}{" "}
                {t("googleIntegration.healthyMappings")}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm">
                {deadLetters.length ? (
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                )}
                <span>{t("googleIntegration.eventProcessing")}</span>
              </div>
              <div className="mt-1 text-2xl font-semibold">
                {deadLetters.length}
              </div>
              <div className="text-sm text-muted-foreground">
                {t("googleIntegration.deadLetters")}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">
                {t("googleIntegration.events")}
              </div>
              <div className="mt-1 text-2xl font-semibold">
                {health.pendingEvents}
              </div>
              <div className="text-xs text-muted-foreground">
                {t("googleIntegration.pending")} · {health.pendingJobs}{" "}
                {t("googleIntegration.running")}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("googleIntegration.attention")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {attention.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("googleIntegration.noAttention")}
            </p>
          ) : (
            <ul className="space-y-3">
              {attention.map((office) => (
                <li
                  key={office.officeId}
                  className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${HEALTH_DOT[office.healthStatus] ?? "bg-muted-foreground"}`}
                    />
                    <span className="font-medium">{office.officeName}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {office.unansweredReviews > 0
                      ? t("googleIntegration.unansweredReviews", {
                          count: office.unansweredReviews,
                        })
                      : t(`googleIntegration.status.${office.healthStatus}`)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("googleIntegration.recentEvents")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("googleIntegration.noEvents")}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {events.map((event) => (
                <div
                  key={event.eventId}
                  className="grid grid-cols-1 items-center gap-1 border-b pb-2 text-sm last:border-0 sm:grid-cols-4"
                >
                  <span className="truncate text-muted-foreground">
                    {formatTime(event.receivedAt)}
                  </span>
                  <span className="truncate font-medium">
                    {event.eventType}
                  </span>
                  <span className="truncate">{event.officeName ?? "—"}</span>
                  <span className="truncate text-muted-foreground">
                    {event.processingStatus}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("googleIntegration.deadLetters")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {deadLetters.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("googleIntegration.noDeadLetters")}
            </p>
          ) : (
            <ul className="space-y-3">
              {deadLetters.map((row) => (
                <li
                  key={row.eventId}
                  className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-0"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-destructive" />
                      <span className="font-medium">{row.eventType}</span>
                      <span className="text-muted-foreground">
                        {row.officeName ?? "—"}
                      </span>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {row.errorMessage ?? row.errorCode ?? "—"}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void retry(row.eventId)}
                  >
                    <RotateCcw className="me-2 h-4 w-4" />
                    {t("googleIntegration.retry")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("googleIntegration.notificationTypes")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-muted-foreground">
            {t("googleIntegration.accountLevelHint")}
          </p>
          <div className="mb-4 grid gap-2 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">
                {t("googleIntegration.topic")}
              </span>
              <Input
                value={topicDraft}
                onChange={(e) => setTopicDraft(e.target.value)}
                placeholder="projects/darb/topics/darb-google-business-events-prod"
                className="font-mono text-xs"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">
                {t("googleIntegration.subscription")}
              </span>
              <Input
                value={subscriptionDraft}
                onChange={(e) => setSubscriptionDraft(e.target.value)}
                placeholder="darb-google-business-events-prod"
                className="font-mono text-xs"
              />
            </label>
          </div>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {supportedTypes.map((type) => (
              <li key={type} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                {t(`googleIntegration.notificationType.${type}`)}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-end">
            <Button
              size="sm"
              variant="outline"
              disabled={busy || !health?.connectionId}
              onClick={() => void saveConfig()}
            >
              {t("googleIntegration.save")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
