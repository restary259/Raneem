import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Megaphone, RefreshCw, Send, ShieldCheck, Users, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, LoadingState } from "@/components/shell/States";
import { useToast } from "@/hooks/use-toast";
import {
  cancelWhatsAppMarketingCampaign,
  createWhatsAppMarketingCampaign,
  dispatchWhatsAppMarketingCampaigns,
  getWhatsAppMarketingAudienceCount,
  listWhatsAppMarketingCampaigns,
  listWhatsAppTemplates,
  type WhatsAppMarketingCampaign,
  type WhatsAppMarketingFilter,
  type WhatsAppTemplate,
} from "@/services/WhatsAppService";

const INTENTS = [
  "",
  "medicine",
  "engineering",
  "computer_science",
  "language_course",
  "visa",
  "accommodation",
  "cost",
  "appointment",
  "documents",
  "application_status",
  "existing_student",
  "other",
] as const;

const LANGUAGES = ["", "ar", "he", "en"] as const;

const STAGES = [
  "",
  "new",
  "qualified",
  "consultation_booked",
  "documents_pending",
  "application_in_progress",
  "won",
  "lost",
] as const;

function templateBody(template: WhatsAppTemplate) {
  if (!Array.isArray(template.components)) return "";
  const body = template.components.find((item) => {
    if (!item || typeof item !== "object") return false;
    return String((item as Record<string, unknown>).type ?? "").toUpperCase() === "BODY";
  }) as Record<string, unknown> | undefined;
  return String(body?.text ?? "");
}

function localDateTimeValue() {
  const date = new Date(Date.now() + 5 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "completed") return "secondary";
  if (status === "failed") return "destructive";
  if (status === "cancelled") return "outline";
  return "default";
}

function campaignDate(value: string | null, locale: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-IL" : locale === "he" ? "he-IL" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function WhatsAppCampaignsPage() {
  const { t, i18n } = useTranslation("whatsapp");
  const { toast } = useToast();
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [campaigns, setCampaigns] = useState<WhatsAppMarketingCampaign[]>([]);
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [intent, setIntent] = useState("all");
  const [language, setLanguage] = useState("all");
  const [campaignKey, setCampaignKey] = useState("");
  const [leadStage, setLeadStage] = useState("all");
  const [source, setSource] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [countLoading, setCountLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const marketingTemplates = useMemo(
    () =>
      templates.filter((item) => {
        const body = templateBody(item);
        return item.category === "MARKETING" && item.approval_status === "APPROVED" && item.is_active !== false && !/\{\{\s*\d+\s*\}\}/.test(body);
      }),
    [templates],
  );

  useEffect(() => {
    if (templateId && marketingTemplates.some((item) => item.id === templateId)) return;
    setTemplateId(marketingTemplates[0]?.id ?? "");
  }, [marketingTemplates, templateId]);

  const filters = useMemo<WhatsAppMarketingFilter>(() => {
    const next: WhatsAppMarketingFilter = {};
    if (intent !== "all") next.intent = intent;
    if (language !== "all") next.language_code = language;
    if (campaignKey.trim()) next.campaign_key = campaignKey.trim();
    if (leadStage !== "all") next.lead_stage = leadStage;
    if (source.trim()) next.source = source.trim();
    return next;
  }, [intent, language, campaignKey, leadStage, source]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [templateRows, campaignRows] = await Promise.all([listWhatsAppTemplates(), listWhatsAppMarketingCampaigns()]);
      setTemplates(templateRows);
      setCampaigns(campaignRows);
    } catch (error) {
      toast({ variant: "destructive", description: error instanceof Error ? error.message : t("campaigns.errors.load") });
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setCountLoading(true);
      try {
        const count = await getWhatsAppMarketingAudienceCount(filters);
        if (!cancelled) setAudienceCount(count);
      } catch {
        if (!cancelled) setAudienceCount(null);
      } finally {
        if (!cancelled) setCountLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [filters]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      setCampaigns(await listWhatsAppMarketingCampaigns());
    } catch (error) {
      toast({ variant: "destructive", description: error instanceof Error ? error.message : t("campaigns.errors.load") });
    } finally {
      setRefreshing(false);
    }
  };

  const createCampaign = async () => {
    if (!name.trim() || !templateId || !audienceCount) return;
    setSaving(true);
    try {
      const scheduled = scheduledAt ? new Date(scheduledAt) : null;
      if (scheduled && !Number.isFinite(scheduled.getTime())) throw new Error(t("campaigns.errors.invalidDate"));
      await createWhatsAppMarketingCampaign({
        name: name.trim(),
        template_id: templateId,
        filters,
        scheduled_at: scheduled ? scheduled.toISOString() : null,
      });

      // Start the first batch immediately for unscheduled campaigns. Cron remains
      // the durable worker/retry path, so a failed kick cannot lose the campaign.
      if (!scheduled) {
        try {
          await dispatchWhatsAppMarketingCampaigns();
        } catch {
          // Leave the campaign queued; the server-side cron will pick it up.
          toast({ variant: "destructive", description: t("campaigns.kickFailed") });
        }
      }

      toast({ description: scheduled ? t("campaigns.createdScheduled") : t("campaigns.createdNow") });
      setName("");
      setScheduledAt("");
      await refresh();
    } catch (error) {
      toast({ variant: "destructive", description: error instanceof Error ? error.message : t("campaigns.errors.create") });
    } finally {
      setSaving(false);
    }
  };

  const cancelCampaign = async (id: string) => {
    try {
      await cancelWhatsAppMarketingCampaign(id);
      toast({ description: t("campaigns.cancelled") });
      await refresh();
    } catch (error) {
      toast({ variant: "destructive", description: error instanceof Error ? error.message : t("campaigns.errors.cancel") });
    }
  };

  if (loading) return <LoadingState variant="table" rows={6} />;

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Megaphone className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t("campaigns.title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("campaigns.subtitle")}</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => void refresh()} disabled={refreshing}>
          <RefreshCw className={`me-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          {t("campaigns.refresh")}
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="rounded-2xl p-5 shadow-none">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <h2 className="font-semibold">{t("campaigns.createTitle")}</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t("campaigns.createHelp")}</p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>{t("campaigns.name")}</Label>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={t("campaigns.namePlaceholder")} maxLength={120} />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label>{t("campaigns.template")}</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger><SelectValue placeholder={t("campaigns.selectTemplate")} /></SelectTrigger>
                <SelectContent>
                  {marketingTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.provider_name} · {template.language_code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!marketingTemplates.length && <p className="text-xs text-muted-foreground">{t("campaigns.noTemplates")}</p>}
            </div>

            <div className="space-y-2">
              <Label>{t("campaigns.intent")}</Label>
              <Select value={intent} onValueChange={setIntent}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{INTENTS.map(([value, label]) => <SelectItem key={value || "all"} value={value || "all"}>{value ? t(`intent.${value}`, label) : t("campaigns.allIntents")}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("campaigns.language")}</Label>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LANGUAGES.map(([value, label]) => <SelectItem key={value || "all"} value={value || "all"}>{value ? t(`language.${value}`, label) : t("campaigns.allLanguages")}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("campaigns.stage")}</Label>
              <Select value={leadStage} onValueChange={setLeadStage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STAGES.map(([value, label]) => <SelectItem key={value || "all"} value={value || "all"}>{value ? t(`stage.${value}`, label) : t("campaigns.allStages")}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("campaigns.campaignKey")}</Label>
              <Input value={campaignKey} onChange={(event) => setCampaignKey(event.target.value)} placeholder={t("campaigns.optional")} />
            </div>

            <div className="space-y-2">
              <Label>{t("campaigns.source")}</Label>
              <Input value={source} onChange={(event) => setSource(event.target.value)} placeholder={t("campaigns.optional")} />
            </div>

            <div className="space-y-2">
              <Label>{t("campaigns.schedule")}</Label>
              <Input type="datetime-local" min={localDateTimeValue()} value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
              <p className="text-xs text-muted-foreground">{t("campaigns.scheduleHelp")}</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("campaigns.audience")}</p>
              <div className="mt-1 flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <strong className="text-xl tabular-nums">{countLoading ? "…" : (audienceCount ?? 0).toLocaleString("en-US")}</strong>
                <span className="text-sm text-muted-foreground">{t("campaigns.optedIn")}</span>
              </div>
            </div>
            <Button onClick={() => void createCampaign()} disabled={saving || countLoading || !name.trim() || !templateId || !audienceCount}>
              <Send className="me-2 h-4 w-4" />
              {saving ? t("campaigns.creating") : scheduledAt ? t("campaigns.scheduleButton") : t("campaigns.launchButton")}
            </Button>
          </div>
        </Card>

        <Card className="rounded-2xl p-5 shadow-none">
          <div className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">{t("campaigns.policyTitle")}</h2>
          </div>
          <div className="mt-4 space-y-3 text-sm">
            <div className="rounded-xl border p-3">{t("campaigns.policyConsent")}</div>
            <div className="rounded-xl border p-3">{t("campaigns.policyApproved")}</div>
            <div className="rounded-xl border p-3">{t("campaigns.policyRecheck")}</div>
            <div className="rounded-xl border p-3">{t("campaigns.policyNoVariables")}</div>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden rounded-2xl shadow-none">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
          <div>
            <h2 className="font-semibold">{t("campaigns.historyTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("campaigns.historyHelp")}</p>
          </div>
          <Badge variant="outline">{campaigns.length.toLocaleString("en-US")}</Badge>
        </div>
        {campaigns.length ? (
          <div className="divide-y">
            {campaigns.map((campaign) => {
              const done = campaign.sent_count + campaign.failed_count + campaign.cancelled_count;
              const total = campaign.recipient_total || 1;
              const progress = Math.min(100, Math.round((done / total) * 100));
              return (
                <div key={campaign.id} className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1.3fr)_170px_220px_110px] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="truncate">{campaign.name}</strong>
                      <Badge variant={statusVariant(campaign.status)}>{campaign.status}</Badge>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{campaign.template_provider_name} · {campaign.template_language_code}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {campaign.scheduled_at ? t("campaigns.scheduledFor", { date: campaignDate(campaign.scheduled_at, i18n.language) }) : t("campaigns.started", { date: campaignDate(campaign.started_at, i18n.language) })}
                    </p>
                  </div>
                  <div className="text-sm">
                    <div className="flex justify-between gap-2 text-xs text-muted-foreground"><span>{t("campaigns.progress")}</span><span>{progress}%</span></div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div><div className="font-semibold">{campaign.recipient_total}</div><div className="text-muted-foreground">{t("campaigns.total")}</div></div>
                    <div><div className="font-semibold text-emerald-600">{campaign.sent_count}</div><div className="text-muted-foreground">{t("campaigns.sent")}</div></div>
                    <div><div className="font-semibold">{campaign.pending_count + campaign.processing_count}</div><div className="text-muted-foreground">{t("campaigns.pending")}</div></div>
                    <div><div className="font-semibold text-destructive">{campaign.failed_count}</div><div className="text-muted-foreground">{t("campaigns.failed")}</div></div>
                  </div>
                  <div className="flex justify-end">
                    {["draft", "scheduled", "running"].includes(campaign.status) && (
                      <Button variant="outline" size="sm" onClick={() => void cancelCampaign(campaign.id)}>
                        <XCircle className="me-2 h-4 w-4" />{t("campaigns.cancel")}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState icon={Megaphone} title={t("campaigns.noneTitle")} />
        )}
      </Card>
    </div>
  );
}
