import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Building2,
  Clock3,
  ExternalLink,
  Link2,
  MapPin,
  RefreshCw,
  ShieldCheck,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  assignGoogleSideManager,
  listMyGoogleOffices,
  listOfficeGoogleOperatorCandidates,
  removeGoogleOperator,
} from "@/lib/googleBusinessApi";
import {
  getOfficeGoogleHealth,
  listOfficeGoogleSyncJobs,
  requestOfficeGoogleSync,
  type OfficeGoogleHealth,
  type OfficeGoogleSyncJob,
} from "@/lib/googleBusinessRealtime.functions";
import { subscribeTables } from "@/lib/realtimeRegistry";
import { useLocation } from "@/lib/router-compat";
import {
  useOfficeWorkspaceSelection,
  type OfficeSurface,
} from "@/lib/officeWorkspace";
import { GoogleOfficeSubnav } from "@/components/google/GoogleOfficeSubnav";
import { useOfficeWorkspaceContext } from "@/components/office/OfficeWorkspaceLayout";
import type {
  MyGoogleOfficeRow,
  OfficeGoogleOperatorCandidate,
} from "@/types/googleBusiness";

function errorMessage(error: unknown): string | undefined {
  return (error as { message?: string } | null)?.message;
}

/** Colour-codes a background sync job's status in the Overview job list. */
const SYNC_JOB_STATUS_CLASS: Record<string, string> = {
  PENDING: "border-muted-foreground/40 text-muted-foreground",
  RUNNING: "border-sky-500/40 text-sky-600",
  SUCCESS: "border-emerald-500/40 text-emerald-600",
  PARTIAL: "border-amber-500/40 text-amber-600",
  FAILED: "border-destructive/40 text-destructive",
  CANCELLED: "border-muted-foreground/40 text-muted-foreground",
};

/**
 * The team-facing Google Business surface (Phase 4).
 *
 * An office's Primary may appoint or remove the Side Manager here; a Side
 * Manager gets a read-only view. Every call goes through the same office-scoped
 * RPCs the admin surface uses, so a forged client cannot reach another office.
 * No Google write happens in this phase.
 */
export default function TeamGoogleBusinessPage() {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();

  // Office context from the canonical office route (or legacy ?office=slug).
  const { officeId: workspaceOfficeId } = useOfficeWorkspaceSelection();
  // Surface is inferred from the URL so the Google sub-navigation links back to
  // the correct office workspace (`/team/...` vs `/admin/...`).
  const location = useLocation();
  const surface: OfficeSurface = location.pathname.startsWith("/admin")
    ? "admin"
    : "team";
  // Inside an office workspace the layout already renders the Google
  // sub-navigation, so this page must not render it a second time.
  const inOfficeWorkspace = useOfficeWorkspaceContext() !== null;

  const [offices, setOffices] = useState<MyGoogleOfficeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await listMyGoogleOffices();
      if (error) throw error;
      setOffices(data || []);
    } catch (error) {
      toast({
        variant: "destructive",
        description: errorMessage(error) || t("team.googleBusiness.loadError"),
      });
    } finally {
      setLoading(false);
    }
  }, [t, toast]);

  useEffect(() => {
    load();
  }, [load]);

  // When a single office is in context (office workspace route), focus only
  // that office and expose the Google sub-navigation.
  const focused = workspaceOfficeId
    ? (offices.find((o) => o.office_id === workspaceOfficeId) ?? null)
    : null;
  const visibleOffices = focused ? [focused] : offices;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-4 pt-4 sm:px-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Link2 className="size-5 text-primary" />
          {t("team.googleBusiness.title")}
        </h1>
      </header>

      {!inOfficeWorkspace && focused?.office_slug ? (
        <GoogleOfficeSubnav
          surface={surface}
          slug={focused.office_slug}
          officeName={focused.office_name}
          active=""
        />
      ) : null}

      {loading ? (
        <Card className="rounded-2xl border-border shadow-sm">
          <CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Clock3 className="size-4 animate-spin" />
            {t("team.googleBusiness.loading")}
          </CardContent>
        </Card>
      ) : visibleOffices.length === 0 ? (
        <Card className="rounded-2xl border-border shadow-sm">
          <CardContent className="space-y-2 py-8 text-center">
            <ShieldCheck className="mx-auto size-8 text-muted-foreground" />
            <p className="text-sm font-medium">
              {t("team.googleBusiness.emptyTitle")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("team.googleBusiness.emptyDesc")}
            </p>
          </CardContent>
        </Card>
      ) : (
        visibleOffices.map((office) => (
          <TeamGoogleOfficeCard
            key={office.office_id}
            office={office}
            busy={busy}
            setBusy={setBusy}
            onChanged={load}
          />
        ))
      )}
    </div>
  );
}

type CardProps = {
  office: MyGoogleOfficeRow;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onChanged: () => void | Promise<void>;
};

function TeamGoogleOfficeCard({ office, busy, setBusy, onChanged }: CardProps) {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();

  const isPrimary = office.operator_role === "PRIMARY";
  const [candidates, setCandidates] = useState<OfficeGoogleOperatorCandidate[]>(
    [],
  );
  const [choice, setChoice] = useState("");
  const [health, setHealth] = useState<OfficeGoogleHealth | null>(null);
  const [jobs, setJobs] = useState<OfficeGoogleSyncJob[]>([]);
  const [syncing, setSyncing] = useState(false);

  const loadHealth = useCallback(async () => {
    try {
      const [h, j] = await Promise.all([
        getOfficeGoogleHealth({ data: { officeId: office.office_id } }),
        listOfficeGoogleSyncJobs({
          data: { officeId: office.office_id, limit: 5 },
        }),
      ]);
      setHealth(h);
      setJobs(j);
    } catch {
      /* health is advisory; the office card still renders */
    }
  }, [office.office_id]);

  useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

  useEffect(
    () =>
      subscribeTables(
        "google-business-office-status",
        ["google_business_location_health", "google_business_sync_jobs"],
        () => void loadHealth(),
      ),
    [loadHealth],
  );

  async function handleSync() {
    setSyncing(true);
    try {
      await requestOfficeGoogleSync({ data: { officeId: office.office_id } });
      toast({ description: t("googleIntegration.syncQueued") });
      await loadHealth();
    } catch (error) {
      toast({
        variant: "destructive",
        description: errorMessage(error) || t("googleIntegration.actionFailed"),
      });
    } finally {
      setSyncing(false);
    }
  }

  const loadCandidates = useCallback(async () => {
    if (!isPrimary) return;
    const { data, error } = await listOfficeGoogleOperatorCandidates(
      office.office_id,
    );
    if (!error) setCandidates(data || []);
  }, [isPrimary, office.office_id]);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  async function run(
    action: () => Promise<{ error: unknown }>,
    successKey: string,
  ) {
    setBusy(true);
    try {
      const { error } = await action();
      if (error) throw error;
      toast({ description: t(successKey) });
      setChoice("");
      await onChanged();
    } catch (error) {
      toast({
        variant: "destructive",
        description:
          errorMessage(error) || t("team.googleBusiness.actionFailed"),
      });
    } finally {
      setBusy(false);
    }
  }

  const sideChoices = candidates.filter(
    (c) =>
      c.operator_role !== "PRIMARY" &&
      c.team_member_id !== office.side_manager_id,
  );

  const locationLabel =
    office.google_location_name || t("team.googleBusiness.locationUnknown");

  return (
    <Card className="rounded-2xl border-border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="flex min-w-0 items-center gap-2 text-lg">
            <Building2 className="size-4 shrink-0 text-primary" />
            <span className="truncate">{office.office_name}</span>
          </CardTitle>
          <Badge variant={isPrimary ? "default" : "secondary"}>
            {isPrimary
              ? t("team.googleBusiness.rolePrimary")
              : t("team.googleBusiness.roleSide")}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="min-w-0 space-y-1">
            <Label className="text-xs text-muted-foreground">
              {t("team.googleBusiness.googleLocation")}
            </Label>
            <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
              <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{locationLabel}</span>
            </p>
            {office.google_maps_url ? (
              <a
                href={office.google_maps_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="size-3" />
                {t("team.googleBusiness.openMaps")}
              </a>
            ) : null}
          </div>

          <div className="min-w-0 space-y-1">
            <Label className="text-xs text-muted-foreground">
              {t("team.googleBusiness.connectionStatus")}
            </Label>
            <p className="text-sm font-medium">
              {t(`team.googleBusiness.connection.${office.connection_status}`, {
                defaultValue: office.connection_status,
              })}
            </p>
            <p className="text-xs text-muted-foreground">
              {t(`team.googleBusiness.mapping.${office.mapping_status}`, {
                defaultValue: office.mapping_status,
              })}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="min-w-0 space-y-1">
            <Label className="text-xs text-muted-foreground">
              {t("team.googleBusiness.primaryOperator")}
            </Label>
            <p className="truncate text-sm font-medium">
              {office.primary_operator_name ||
                t("team.googleBusiness.notAssigned")}
            </p>
          </div>
          <div className="min-w-0 space-y-1">
            <Label className="text-xs text-muted-foreground">
              {t("team.googleBusiness.sideManager")}
            </Label>
            <p className="truncate text-sm font-medium">
              {office.side_manager_name || t("team.googleBusiness.notAssigned")}
            </p>
          </div>
        </div>

        <section className="space-y-3 rounded-xl border border-border bg-muted/30 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span
                className={`inline-block size-2 rounded-full ${
                  health?.healthStatus === "HEALTHY"
                    ? "bg-emerald-500"
                    : health?.healthStatus === "ATTENTION" ||
                        health?.healthStatus === "ACTION_REQUIRED"
                      ? "bg-amber-500"
                      : health?.healthStatus === "UNAVAILABLE"
                        ? "bg-destructive"
                        : "bg-muted-foreground/50"
                }`}
              />
              {t("googleIntegration.officeHealth")}
              <span className="text-muted-foreground">
                {health
                  ? t(`googleIntegration.status.${health.healthStatus}`, {
                      defaultValue: health.healthStatus,
                    })
                  : t("googleIntegration.loading")}
              </span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={syncing || busy}
              onClick={() => void handleSync()}
            >
              <RefreshCw
                className={`me-2 size-3.5 ${syncing ? "animate-spin" : ""}`}
              />
              {t("googleIntegration.syncOffice")}
            </Button>
          </div>
          {health?.lastGoogleEventAt ? (
            <p className="text-xs text-muted-foreground">
              {t("googleIntegration.lastEvent")}:{" "}
              {new Date(health.lastGoogleEventAt).toLocaleString()}
            </p>
          ) : null}
          {health?.lastErrorMessage ? (
            <p className="text-xs text-destructive">
              {health.lastErrorMessage}
            </p>
          ) : null}
          {jobs.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                {t("googleIntegration.recentSyncs")}
              </p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {jobs.map((job) => (
                  <li key={job.jobId} className="flex items-center gap-2">
                    <span className="font-medium">
                      {t(`googleIntegration.syncType.${job.syncType}`, {
                        defaultValue: job.syncType,
                      })}
                    </span>
                    <Badge
                      variant="outline"
                      className={SYNC_JOB_STATUS_CLASS[job.status] ?? ""}
                    >
                      {t(`googleIntegration.syncStatus.${job.status}`, {
                        defaultValue: job.status,
                      })}
                    </Badge>
                    {job.recordsProcessed > 0 ? (
                      <span>· {job.recordsProcessed}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        {isPrimary ? (
          <section className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Users className="size-4 text-primary" />
              {t("team.googleBusiness.manageSideManager")}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("team.googleBusiness.manageSideManagerDesc")}
            </p>
            <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-[1fr_auto]">
              <Select
                value={choice || "none"}
                onValueChange={(v) => setChoice(v === "none" ? "" : v)}
              >
                <SelectTrigger className="min-w-0">
                  <SelectValue
                    placeholder={t("team.googleBusiness.selectMember")}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    {t("team.googleBusiness.notAssigned")}
                  </SelectItem>
                  {sideChoices.map((c) => (
                    <SelectItem key={c.team_member_id} value={c.team_member_id}>
                      {c.full_name || c.team_member_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="sm"
                disabled={busy || !choice}
                onClick={() =>
                  run(
                    () => assignGoogleSideManager(office.office_id, choice),
                    "team.googleBusiness.sideManagerSaved",
                  )
                }
              >
                {busy ? (
                  <Clock3 className="me-2 size-4 animate-spin" />
                ) : (
                  <UserPlus className="me-2 size-4" />
                )}
                {office.side_manager_id
                  ? t("team.googleBusiness.change")
                  : t("team.googleBusiness.addSideManager")}
              </Button>
            </div>
            {office.side_manager_id ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() =>
                  run(
                    () =>
                      removeGoogleOperator(office.office_id, "SIDE_MANAGER"),
                    "team.googleBusiness.sideManagerRemoved",
                  )
                }
              >
                <UserMinus className="me-2 size-4" />
                {t("team.googleBusiness.removeSideManager")}
              </Button>
            ) : null}
          </section>
        ) : (
          <p className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            {t("team.googleBusiness.sideReadOnly")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
