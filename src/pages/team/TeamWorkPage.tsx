import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CalendarDays, Clock, RotateCcw, Users } from "lucide-react";
import AppointmentOutcomeModal from "@/components/team/AppointmentOutcomeModal";
import { LoadingState, EmptyState } from "@/components/shell";

const STALE_DAYS = 7;
const DAY_MS = 86_400_000;

interface ApptRow {
  id: string;
  case_id: string | null;
  scheduled_at: string;
  duration_minutes: number;
  outcome: string | null;
  notes: string | null;
  case?: { full_name: string } | null;
}

interface CaseRow {
  id: string;
  full_name: string;
  status: string;
  last_activity_at: string;
  case_reference: string | null;
}

interface ReturnedRow {
  id: string;
  case_id: string;
  review_note: string | null;
  reviewed_at: string | null;
  case?: { full_name: string; case_reference: string | null } | null;
}

const timeFmt = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const dateTimeFmt = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export default function TeamWorkPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation("dashboard");
  const isRtl = i18n.language === "ar";

  const [loading, setLoading] = useState(true);
  const [todayAppts, setTodayAppts] = useState<ApptRow[]>([]);
  const [overdueAppts, setOverdueAppts] = useState<ApptRow[]>([]);
  const [overdueCount, setOverdueCount] = useState(0);
  const [returned, setReturned] = useState<ReturnedRow[]>([]);
  const [returnedCount, setReturnedCount] = useState(0);
  const [staleCases, setStaleCases] = useState<CaseRow[]>([]);
  const [totalCases, setTotalCases] = useState(0);
  const [outcomeApptId, setOutcomeApptId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    let ignore = false;
    setLoading(true);
    try {
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date();
      dayEnd.setHours(23, 59, 59, 999);
      const nowIso = new Date().toISOString();
      const staleBefore = new Date(Date.now() - STALE_DAYS * DAY_MS).toISOString();

      const [todayRes, overdueRes, overdueCountRes, casesRes, staleRes] = await Promise.all([
        supabase
          .from("appointments")
          .select("id, case_id, scheduled_at, duration_minutes, outcome, notes, case:cases(full_name)")
          .eq("team_member_id", user.id)
          .gte("scheduled_at", dayStart.toISOString())
          .lte("scheduled_at", dayEnd.toISOString())
          .order("scheduled_at"),
        supabase
          .from("appointments")
          .select("id, case_id, scheduled_at, duration_minutes, outcome, notes, case:cases(full_name)")
          .eq("team_member_id", user.id)
          .lt("scheduled_at", dayStart.toISOString())
          .is("outcome", null)
          .order("scheduled_at", { ascending: false })
          .limit(10),
        // Accurate count for the KPI — counts every null-outcome appointment before
        // now (prior-day overdue + today's already-passed slots), matching the total
        // number of visible "Record outcome" actions across both the overdue card and
        // Today's schedule. The display lists above/below are capped/segmented; this is
        // a single head-count that never double-counts.
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("team_member_id", user.id)
          .lt("scheduled_at", nowIso)
          .is("outcome", null),
        supabase
          .from("cases")
          .select("id", { count: "exact", head: true })
          .eq("assigned_to", user.id)
          .is("deleted_at", null)
          .eq("archived", false),
        supabase
          .from("cases")
          .select("id, full_name, status, last_activity_at, case_reference")
          .eq("assigned_to", user.id)
          .is("deleted_at", null)
          .eq("archived", false)
          .lt("last_activity_at", staleBefore)
          .not("status", "in", "(enrollment_paid,cancelled)")
          .order("last_activity_at")
          .limit(10),
      ]);

      if (todayRes.error) throw todayRes.error;
      if (overdueRes.error) throw overdueRes.error;
      if (overdueCountRes.error) throw overdueCountRes.error;
      if (casesRes.error) throw casesRes.error;
      if (staleRes.error) throw staleRes.error;

      if (ignore) return;
      setTodayAppts((todayRes.data as unknown as ApptRow[]) ?? []);
      setOverdueAppts((overdueRes.data as unknown as ApptRow[]) ?? []);
      setOverdueCount(overdueCountRes.count ?? 0);
      setTotalCases(casesRes.count ?? 0);
      setStaleCases((staleRes.data as CaseRow[]) ?? []);

      const caseIds = ((staleRes.data as CaseRow[]) ?? []).map((c) => c.id);
      // Returned submissions are scoped by RLS to the cases assigned to this member.
      const [returnedRes, returnedCountRes] = await Promise.all([
        supabase
          .from("case_submissions")
          .select("id, case_id, review_note, reviewed_at, case:cases(full_name, case_reference)")
          .eq("review_status", "changes_requested")
          .is("deleted_at", null)
          .order("reviewed_at", { ascending: false })
          .limit(10),
        // Accurate count for the KPI — the display list above is capped at 10.
        supabase
          .from("case_submissions")
          .select("id", { count: "exact", head: true })
          .eq("review_status", "changes_requested")
          .is("deleted_at", null),
      ]);
      if (returnedRes.error) throw returnedRes.error;
      if (returnedCountRes.error) throw returnedCountRes.error;
      if (ignore) return;
      setReturned((returnedRes.data as unknown as ReturnedRow[]) ?? []);
      setReturnedCount(returnedCountRes.count ?? 0);
      void caseIds;
    } catch (err) {
      console.error("TeamWorkPage fetchData error:", err);
    } finally {
      if (!ignore) setLoading(false);
    }
    return () => { ignore = true; };
  }, [user]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    fetchData().then((fn) => { cleanup = fn; });
    return () => { cleanup?.(); };
  }, [fetchData]);

  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const stats = [
    {
      icon: CalendarDays,
      label: t("team.work.statToday", "Today's appointments"),
      value: todayAppts.length,
      tone: "text-primary",
    },
    {
      icon: AlertTriangle,
      label: t("team.work.statOutcomes", "Outcomes to record"),
      value: overdueCount,
      tone: "text-destructive",
    },
    {
      icon: RotateCcw,
      label: t("team.work.statReturned", "Returned by admin"),
      value: returnedCount,
      tone: "text-[hsl(var(--status-payment))]",
    },
    {
      icon: Users,
      label: t("team.work.statCases", "Assigned cases"),
      value: totalCases,
      tone: "text-primary",
    },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto" dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{t("team.work.title", "My work")}</h1>
          <p className="text-sm text-muted-foreground" dir="ltr">
            {dateStr}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => navigate("/team/cases")}>
          {t("team.work.allCases", "All cases")}
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={`h-4 w-4 ${s.tone}`} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <div className="text-2xl font-bold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {returned.length > 0 && (
        <Card className="border-[hsl(var(--status-payment)/0.5)] bg-[hsl(var(--status-payment)/0.05)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-[hsl(var(--status-payment))]" />
              {t("team.work.returnedTitle", "Returned by admin — changes requested")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {returned.map((r) => (
              <div
                key={r.id}
                className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3 min-w-0 rounded-lg border border-border bg-background p-3 transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{r.case?.full_name ?? "—"}</div>
                  {r.case?.case_reference && (
                    <div className="text-xs text-muted-foreground" dir="ltr">
                      {r.case.case_reference}
                    </div>
                  )}
                  {r.review_note && (
                    <p className="text-sm text-muted-foreground mt-1">{r.review_note}</p>
                  )}
                </div>
                <Button size="sm" onClick={() => navigate(`/team/cases/${r.case_id}`)}>
                  {t("team.work.openCase", "Open case")}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {overdueAppts.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              {t("team.work.overdueTitle", "Appointments needing an outcome")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {overdueAppts.map((a) => (
              <div
                key={a.id}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 min-w-0 rounded-lg border border-border bg-background p-3"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{a.case?.full_name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground" dir="ltr">
                    {dateTimeFmt(a.scheduled_at)}
                  </div>
                </div>
                <Button size="sm" variant="destructive" onClick={() => setOutcomeApptId(a.id)}>
                  {t("team.work.recordOutcome", "Record outcome")}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              {t("team.work.scheduleTitle", "Today's schedule")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <LoadingState variant="rows" rows={3} label={t("common.loading", "Loading...")} />
            ) : todayAppts.length === 0 ? (
              <EmptyState title={t("team.work.noAppointments", "No appointments today")} className="py-6" />
            ) : (
              <div className="space-y-2">
                {todayAppts.map((a) => (
                  <div
                    key={a.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 min-w-0 rounded-lg border border-border p-3 transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">{a.case?.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground" dir="ltr">
                        {timeFmt(a.scheduled_at)} · {a.duration_minutes}m
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                      {a.outcome ? (
                        <Badge variant="secondary">
                          {t(`team.outcome.${a.outcome}`, a.outcome)}
                        </Badge>
                      ) : new Date(a.scheduled_at).getTime() < Date.now() ? (
                        <Button size="sm" variant="destructive" onClick={() => setOutcomeApptId(a.id)}>
                          {t("team.work.recordOutcome", "Record outcome")}
                        </Button>
                      ) : (
                        <Badge className="bg-primary/10 text-primary border-primary/20">
                          {t("team.work.upcoming", "Upcoming")}
                        </Badge>
                      )}
                      {a.case_id && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/team/cases/${a.case_id}`)}
                        >
                          {t("team.work.openCase", "Open case")}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-[hsl(var(--status-payment))]" />
              {t("team.work.staleTitle", "Cases with no activity")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <LoadingState variant="rows" rows={3} label={t("common.loading", "Loading...")} />
            ) : staleCases.length === 0 ? (
              <EmptyState title={t("team.work.noStale", "Every case has recent activity")} className="py-6" />
            ) : (
              <div className="space-y-2">
                {staleCases.map((c) => {
                  const days = Math.floor(
                    (Date.now() - new Date(c.last_activity_at).getTime()) / DAY_MS,
                  );
                  return (
                    <div
                      key={c.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 min-w-0 rounded-lg border border-border p-3 transition-colors hover:bg-muted/40"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">{c.full_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {t("team.work.staleDays", "{{days}} days without activity", { days })}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/team/cases/${c.id}`)}
                      >
                        {t("team.work.openCase", "Open case")}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {outcomeApptId && (
        <AppointmentOutcomeModal
          open={!!outcomeApptId}
          onClose={() => setOutcomeApptId(null)}
          appointmentId={outcomeApptId}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
}
