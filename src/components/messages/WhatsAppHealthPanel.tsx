import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2, Inbox, RefreshCw, Send, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, LoadingState } from "@/components/shell/States";
import { useToast } from "@/hooks/use-toast";
import {
  getWhatsAppHealth,
  listWhatsAppFailedJobs,
  listWhatsAppIngestFailures,
  resolveWhatsAppIngestFailure,
  retryWhatsAppFailedJob,
  type WhatsAppFailedJob,
  type WhatsAppHealth,
  type WhatsAppIngestFailure,
} from "@/services/WhatsAppService";

/**
 * Delivery health. Everything here is read through role-gated RPCs: admins see
 * every failure, team members only the ones on conversations they own.
 */
export default function WhatsAppHealthPanel({ isAdmin }: { isAdmin: boolean }) {
  const { t, i18n } = useTranslation("whatsapp");
  const { toast } = useToast();
  const [health, setHealth] = useState<WhatsAppHealth | null>(null);
  const [failures, setFailures] = useState<WhatsAppIngestFailure[]>([]);
  const [jobs, setJobs] = useState<WhatsAppFailedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const fmt = (value: string | null) =>
    value ? new Intl.DateTimeFormat(i18n.language === "ar" ? "ar-IL" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";

  const load = useCallback(async () => {
    try {
      const [healthRow, jobRows, failureRows] = await Promise.all([
        getWhatsAppHealth(),
        listWhatsAppFailedJobs(),
        isAdmin ? listWhatsAppIngestFailures() : Promise.resolve([] as WhatsAppIngestFailure[]),
      ]);
      setHealth(healthRow);
      setJobs(jobRows);
      setFailures(failureRows);
    } catch (error) {
      toast({ variant: "destructive", description: error instanceof Error ? error.message : t("errors.load") });
    } finally {
      setLoading(false);
    }
  }, [isAdmin, t, toast]);

  useEffect(() => { void load(); }, [load]);

  const markHandled = async (id: string) => {
    setBusy(id);
    try {
      await resolveWhatsAppIngestFailure(id);
      setFailures((current) => current.filter((item) => item.id !== id));
      toast({ description: t("health.handled", "Marked as handled") });
    } catch (error) {
      toast({ variant: "destructive", description: error instanceof Error ? error.message : t("errors.save") });
    } finally { setBusy(null); }
  };

  const retry = async (job: WhatsAppFailedJob) => {
    setBusy(job.id);
    try {
      await retryWhatsAppFailedJob(job.kind, job.id);
      setJobs((current) => current.filter((item) => item.id !== job.id));
      toast({ description: t("health.retried", "Queued again") });
    } catch (error) {
      toast({ variant: "destructive", description: error instanceof Error ? error.message : t("errors.save") });
    } finally { setBusy(null); }
  };

  if (loading) return <LoadingState variant="cards" rows={3} label={t("health.title", "Delivery health")} />;

  const kpis: [string, number, string][] = [
    [t("health.in", "Messages in"), health?.inbound ?? 0, "text-foreground"],
    [t("health.out", "Messages out"), health?.outbound ?? 0, "text-foreground"],
    [t("health.delivered", "Delivered"), health?.delivered ?? 0, "text-emerald-600"],
    [t("health.failed", "Failed"), health?.failed ?? 0, "text-destructive"],
    [t("health.queued", "Queued"), health?.queued ?? 0, "text-amber-600"],
  ];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">{t("health.today", "Today at a glance")}</h3>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {kpis.map(([label, value, tone]) => (
            <Card key={label} className="rounded-xl p-3 shadow-none">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={`mt-1 text-xl font-semibold ${tone}`}>{value}</p>
            </Card>
          ))}
        </div>
      </div>

      {isAdmin && (
        <Card className="rounded-xl p-4 shadow-none">
          <div className="flex flex-wrap items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-semibold">{t("health.blockedTitle", "Blocked incoming messages")}</h3>
            {failures.length > 0 && <Badge variant="destructive">{failures.length}</Badge>}
            <Button size="icon" variant="ghost" className="ms-auto h-8 w-8" onClick={() => void load()} aria-label={t("actions.refresh")}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          {failures.length ? (
            <div className="mt-3 space-y-2">
              {failures.map((item) => (
                <div key={item.id} className="rounded-lg border p-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{item.event_type || t("health.unknownEvent", "unknown")}</Badge>
                    {item.phone_number && <span dir="ltr" className="text-muted-foreground">{item.phone_number}</span>}
                    <span className="text-muted-foreground">{fmt(item.created_at)}</span>
                    <Button size="sm" variant="outline" className="ms-auto h-7" disabled={busy === item.id} onClick={() => void markHandled(item.id)}>
                      <CheckCircle2 className="me-1.5 h-3.5 w-3.5" />{t("health.markHandled", "Mark handled")}
                    </Button>
                  </div>
                  <p className="mt-1.5 break-words text-muted-foreground">{item.error_code ? `${item.error_code}: ` : ""}{item.error_message || "—"}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState className="py-6" title={t("health.nothingFailed", "Nothing failed")} description={t("health.blockedEmpty", "Every incoming message was processed.")} icon={Inbox} />
          )}
        </Card>
      )}

      <Card className="rounded-xl p-4 shadow-none">
        <div className="flex flex-wrap items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <h3 className="text-sm font-semibold">{t("health.jobsTitle", "Messages that never went out")}</h3>
          {jobs.length > 0 && <Badge variant="destructive">{jobs.length}</Badge>}
        </div>
        {jobs.length ? (
          <div className="mt-3 space-y-2">
            {jobs.map((job) => (
              <div key={`${job.kind}:${job.id}`} className="rounded-lg border p-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{t(`health.kind.${job.kind}`, job.kind)}</Badge>
                  <span className="font-medium">{job.contact_name || job.phone_number || "—"}</span>
                  <span className="text-muted-foreground">{fmt(job.failed_at)}</span>
                  {job.attempt_count != null && <span className="text-muted-foreground">{t("health.attempts", { count: job.attempt_count, defaultValue: "{{count}} attempts" })}</span>}
                  {isAdmin && (
                    <Button size="sm" variant="outline" className="ms-auto h-7" disabled={busy === job.id} onClick={() => void retry(job)}>
                      <Send className="me-1.5 h-3.5 w-3.5" />{t("health.retry", "Retry")}
                    </Button>
                  )}
                </div>
                <p className="mt-1.5 break-words text-muted-foreground">{job.last_error || "—"}</p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState className="py-6" title={t("health.nothingFailed", "Nothing failed")} description={t("health.jobsEmpty", "Every scheduled message went out.")} icon={Send} />
        )}
      </Card>
    </div>
  );
}
