import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Calendar, ChevronDown, FileText, MessageSquare, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { formatDateMedium, formatDateTime } from "@/utils/dateUtils";
import { Badge } from "@/components/ui/badge";
import { statusColorClasses } from "@/lib/caseStatus";
import type { AppointmentRow } from "@/components/cases/CaseStageBlock";
import CaseTimeline from "@/components/cases/CaseTimeline";
import { listCaseMessages, type CaseMessage } from "@/services/CaseMessageService";
import type { CaseTask } from "@/components/cases/caseTasks";
import type { PipelineStatus } from "@/lib/caseStatus";

interface Props {
  caseData: Record<string, any>;
  statusMeta?: PipelineStatus | null;
  /** Owner of the case, resolved by the parent (staff directory hides peers). */
  assigneeName?: string | null;
  appointments?: AppointmentRow[];
  documents?: { category: string }[];
  /** Tasks used for the "next action" callout. */
  tasks?: CaseTask[];
  /** Lets the embedded timeline attach internal notes. */
  canAddNote?: boolean;
}

const ACTION_KEY: Record<CaseTask["action"], string> = {
  upload_document: "case.tasks.action.uploadDocument",
  schedule_appointment: "case.tasks.action.schedule",
  record_outcome: "case.tasks.action.recordOutcome",
  add_note: "case.tasks.action.addNote",
};

/**
 * Overview tab: the full case summary. Status + owner, the single most
 * important next action, appointments, documents, the latest messages and the
 * timeline are all visible without hunting across tabs. The raw application
 * form details stay available under a collapsed "details" section.
 */
export default function CaseOverviewPanel({
  caseData,
  statusMeta,
  assigneeName,
  appointments = [],
  documents = [],
  tasks = [],
  canAddNote = false,
}: Props) {
  const { t } = useTranslation("dashboard");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [referrerName, setReferrerName] = useState<string | null>(null);
  const [messages, setMessages] = useState<CaseMessage[]>([]);

  useEffect(() => {
    const ids = [caseData.partner_id, caseData.referred_by].filter(Boolean) as string[];
    if (ids.length === 0) return;
    (supabase as any)
      .from("profiles")
      .select("id, full_name")
      .in("id", ids)
      .then(({ data }: any) => {
        const find = (id?: string | null) =>
          id ? (data ?? []).find((p: any) => p.id === id)?.full_name ?? null : null;
        setPartnerName(find(caseData.partner_id));
        setReferrerName(find(caseData.referred_by));
      });
  }, [caseData.partner_id, caseData.referred_by]);

  useEffect(() => {
    let active = true;
    if (!caseData.id) return;
    listCaseMessages(caseData.id, 3)
      .then((rows) => {
        if (active) setMessages(rows);
      })
      .catch(() => {
        if (active) setMessages([]);
      });
    return () => {
      active = false;
    };
  }, [caseData.id]);

  const nextTask = tasks[0];

  /** Next appointment that has not been closed out yet. */
  const nextAppointment = useMemo(
    () =>
      appointments
        .filter((a) => !a.outcome)
        .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0],
    [appointments],
  );

  const upcomingAppointments = useMemo(
    () =>
      [...appointments]
        .filter((a) => !a.outcome)
        .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
        .slice(0, 3),
    [appointments],
  );

  const docCategories = useMemo(
    () => Array.from(new Set(documents.map((d) => d.category))),
    [documents],
  );

  const statusLabel = statusMeta
    ? t(`case.status.${statusMeta.key}`, statusMeta.label_en ?? statusMeta.key)
    : t(`case.status.${caseData.status}`, caseData.status);

  const notSet = t("case.overview.notSet");

  const detailsRows: { label: string; value: string | null }[] = [
    { label: t("case.overview.phone"), value: caseData.phone_number ?? null },
    { label: t("case.fields.city"), value: caseData.city ?? null },
    {
      label: t("case.overview.educationLevel"),
      value: caseData.education_level
        ? t(`case.education.${caseData.education_level}`, caseData.education_level)
        : null,
    },
    { label: t("case.overview.passportType"), value: caseData.passport_type ?? null },
    { label: t("case.overview.degreeInterest"), value: caseData.degree_interest ?? null },
    { label: t("case.overview.bagrut"), value: caseData.bagrut_score ? String(caseData.bagrut_score) : null },
    {
      label: t("case.overview.englishUnits"),
      value: caseData.english_units ? String(caseData.english_units) : null,
    },
    { label: t("case.overview.mathUnits"), value: caseData.math_units ? String(caseData.math_units) : null },
    { label: t("case.overview.intake"), value: caseData.intake_notes ?? null },
    {
      label: t("case.overview.source"),
      value: caseData.source ? t(`case.source.${caseData.source}`, caseData.source) : null,
    },
    { label: t("case.overview.partner"), value: partnerName },
    { label: t("case.overview.referredBy"), value: referrerName },
    { label: t("case.overview.createdAt"), value: formatDateMedium(caseData.created_at, null) },
  ];

  return (
    <section className="space-y-3">
      {/* Summary strip */}
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div>
            <p className="mb-1 text-[11px] text-muted-foreground">{t("case.overview.status")}</p>
            <Badge
              variant="outline"
              className={`shrink-0 whitespace-nowrap border ${statusColorClasses(statusMeta?.color)}`}
            >
              {statusLabel}
            </Badge>
          </div>
          <div>
            <p className="mb-1 text-[11px] text-muted-foreground">
              <User className="me-1 inline h-3 w-3 align-[-2px]" />
              {t("case.overview.owner")}
            </p>
            <p className="text-sm">
              {assigneeName ?? t("case.header.unassigned", "Unassigned")}
            </p>
          </div>
          <div>
            <p className="mb-1 text-[11px] text-muted-foreground">
              <Calendar className="me-1 inline h-3 w-3 align-[-2px]" />
              {t("case.overview.nextAppointment")}
            </p>
            <p className={cn("text-sm", nextAppointment ? "text-foreground" : "text-muted-foreground")}>
              {nextAppointment
                ? formatDateTime(nextAppointment.scheduled_at, notSet)
                : t("case.overview.noAppointments")}
            </p>
          </div>
          <div>
            <p className="mb-1 text-[11px] text-muted-foreground">
              <FileText className="me-1 inline h-3 w-3 align-[-2px]" />
              {t("case.overview.documents")}
            </p>
            <p className={cn("text-sm", documents.length > 0 ? "text-foreground" : "text-muted-foreground")}>
              {documents.length > 0
                ? t("case.overview.docsCount", { count: documents.length, total: documents.length })
                : t("case.overview.noDocuments")}
            </p>
          </div>
        </div>
      </div>

      {/* Next action */}
      {nextTask && (
        <div className="rounded-xl border bg-card px-4 py-3 sm:px-5">
          <p className="text-[11px] text-muted-foreground">{t("case.overview.nextAction")}</p>
          <p className="mt-0.5 text-sm font-medium text-foreground">
            {t(nextTask.labelKey, nextTask.values)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t(ACTION_KEY[nextTask.action])}</p>
        </div>
      )}

      {/* Appointments */}
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <h2 className="mb-2 text-sm font-semibold">{t("case.overview.appointments")}</h2>
        {upcomingAppointments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("case.overview.noAppointments")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {upcomingAppointments.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-foreground">{formatDateTime(a.scheduled_at, notSet)}</span>
                <span className="text-xs text-muted-foreground">
                  {a.duration_minutes ? `${a.duration_minutes} min` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Documents */}
      {docCategories.length > 0 && (
        <div className="rounded-xl border bg-card p-4 sm:p-5">
          <h2 className="mb-2 text-sm font-semibold">{t("case.overview.documents")}</h2>
          <div className="flex flex-wrap gap-1.5">
            {docCategories.map((cat) => (
              <Badge key={cat} variant="secondary">
                {t(`case.docCategory.${cat}`, cat)}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Latest messages */}
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <h2 className="mb-2 text-sm font-semibold">{t("case.overview.latestMessages")}</h2>
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("case.overview.noMessages")}</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {messages.map((m) => (
              <li key={m.id}>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate font-medium text-foreground">
                    {m.author_name ?? t("caseTimeline.system")}
                  </span>
                  <span className="shrink-0" title={m.created_at}>
                    {formatDateMedium(m.created_at, "")}
                  </span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-sm text-foreground">{m.body}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Timeline */}
      <CaseTimeline caseId={caseData.id} canAddNote={canAddNote} />

      {/* Application details (collapsed) */}
      <section className="rounded-xl border bg-card">
        <button
          type="button"
          onClick={() => setDetailsOpen((v) => !v)}
          aria-expanded={detailsOpen}
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-start sm:px-5"
        >
          <span className="text-sm font-medium">{t("case.overview.details")}</span>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", detailsOpen && "rotate-180")} />
        </button>
        {detailsOpen && (
          <div className="grid grid-cols-1 gap-4 border-t px-4 py-4 sm:grid-cols-3 sm:px-5">
            {detailsRows.map((row) => (
              <div key={row.label}>
                <p className="mb-0.5 text-[11px] text-muted-foreground">{row.label}</p>
                <p className={cn("text-sm", row.value ? "text-foreground" : "text-muted-foreground")}>
                  {row.value ?? notSet}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
