import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { History, Loader2, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { addCaseNote, useCaseEvents, type CaseEvent } from "@/hooks/useCaseEvents";
import {
  CASE_EVENT_CATEGORIES,
  PAYLOAD_FIELD_ORDER,
  eventMeta,
  type CaseEventCategory,
} from "./caseEventMeta";

interface CaseTimelineProps {
  caseId: string;
  /** Team/admin views can attach notes; the student view is read-only. */
  canAddNote?: boolean;
}

const DATE_LOCALE = "en-US";

function useRelativeTime() {
  const { i18n } = useTranslation();
  const lang = i18n.language?.startsWith("ar") ? "ar-u-nu-latn" : "en-US";
  return useMemo(() => {
    const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
    return (iso: string) => {
      const diffMs = new Date(iso).getTime() - Date.now();
      const abs = Math.abs(diffMs);
      const min = 60_000;
      const hour = 60 * min;
      const day = 24 * hour;
      if (abs < hour) return rtf.format(Math.round(diffMs / min), "minute");
      if (abs < day) return rtf.format(Math.round(diffMs / hour), "hour");
      if (abs < 30 * day) return rtf.format(Math.round(diffMs / day), "day");
      return rtf.format(Math.round(diffMs / (30 * day)), "month");
    };
  }, [lang]);
}

const formatExact = (iso: string) =>
  new Date(iso).toLocaleString(DATE_LOCALE, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

function PayloadDetails({ payload }: { payload: Record<string, unknown> }) {
  const { t } = useTranslation("dashboard");
  const entries = PAYLOAD_FIELD_ORDER.filter(
    (k) => payload[k] !== undefined && payload[k] !== null && payload[k] !== "",
  );
  if (entries.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
      {entries.map((key) => {
        const raw = payload[key];
        let value = String(raw);
        if (key === "scheduled_at" || key === "from" || key === "to") {
          const asDate = typeof raw === "string" && /\d{4}-\d{2}-\d{2}T/.test(raw);
          if (asDate) value = formatExact(raw as string);
        }
        if (key === "amount" || key === "service_fee") {
          value = `₪${Number(raw).toLocaleString(DATE_LOCALE)}`;
        }
        return (
          <span key={key} className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground/70">
              {t(`caseTimeline.field.${key}`, { defaultValue: key })}:
            </span>{" "}
            {t(`caseTimeline.value.${value}`, { defaultValue: value })}
          </span>
        );
      })}
    </div>
  );
}

function TimelineRow({ event, isLast }: { event: CaseEvent; isLast: boolean }) {
  const { t } = useTranslation("dashboard");
  const relative = useRelativeTime();
  const meta = eventMeta(event.event_type);
  const Icon = meta.icon;

  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {!isLast && (
        <span className="absolute top-8 bottom-0 start-[15px] w-px bg-border" aria-hidden="true" />
      )}
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${meta.tone}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-sm font-medium text-foreground">
            {t(`caseTimeline.event.${event.event_type}`, { defaultValue: event.event_type })}
          </p>
          {event.is_internal && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {t("caseTimeline.internal")}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground" title={formatExact(event.created_at)}>
            {relative(event.created_at)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {event.actor_name || t("caseTimeline.system")}
        </p>
        <PayloadDetails payload={event.payload || {}} />
      </div>
    </li>
  );
}

export default function CaseTimeline({ caseId, canAddNote = false }: CaseTimelineProps) {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();
  const { events, loading, error, hasMore, loadMore, refetch } = useCaseEvents(caseId);
  const [filter, setFilter] = useState<CaseEventCategory | "all">("all");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const visible = useMemo(
    () => (filter === "all" ? events : events.filter((e) => eventMeta(e.event_type).category === filter)),
    [events, filter],
  );

  const submitNote = async () => {
    setSaving(true);
    const { error: err } = await addCaseNote(caseId, note);
    setSaving(false);
    if (err) {
      toast({ variant: "destructive", description: err.message });
      return;
    }
    setNote("");
    void refetch();
    toast({ description: t("caseTimeline.noteAdded") });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4" /> {t("caseTimeline.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {(["all", ...CASE_EVENT_CATEGORIES] as const).map((cat) => (
            <Button
              key={cat}
              type="button"
              size="sm"
              variant={filter === cat ? "default" : "outline"}
              className="h-7 rounded-full px-3 text-xs"
              onClick={() => setFilter(cat)}
            >
              {t(`caseTimeline.category.${cat}`)}
            </Button>
          ))}
        </div>

        {canAddNote && (
          <div className="space-y-2">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("caseTimeline.notePlaceholder")}
              rows={2}
              className="text-sm"
            />
            <Button size="sm" onClick={submitNote} disabled={saving || !note.trim()}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              <span className="ms-1">{t("caseTimeline.addNote")}</span>
            </Button>
          </div>
        )}

        {loading && events.length === 0 ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">{t("caseTimeline.empty")}</p>
        ) : (
          <ol className="mt-1">
            {visible.map((e, i) => (
              <TimelineRow key={e.id} event={e} isLast={i === visible.length - 1} />
            ))}
          </ol>
        )}

        {hasMore && filter === "all" && (
          <Button variant="ghost" size="sm" className="w-full" onClick={loadMore} disabled={loading}>
            {t("caseTimeline.loadMore")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
