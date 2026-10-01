import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Link2,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
  adminAssignGooglePrimary,
  assignGoogleSideManager,
  getGoogleBusinessActivity,
  getOfficeGoogleMapping,
  listOfficeGoogleOperatorCandidates,
  removeGoogleOperator,
} from "@/lib/googleBusinessApi";
import {
  discoverGoogleBusinessLocations,
  mapOfficeGoogleLocation,
  unmapOfficeGoogleLocation,
  type DiscoveredLocation,
} from "@/lib/googleBusinessLocation.functions";
import { canGoogleOfficeAction } from "@/lib/googlePermissions";
import { suggestLocationMatch } from "@/lib/googleLocationMatch";
import { googleSyncHealth } from "@/types/googleBusiness";
import type {
  GoogleBusinessActivityRow,
  GoogleConnectionStatus,
  GoogleOperatorRole,
  OfficeGoogleMappingRow,
  OfficeGoogleOperatorCandidate,
} from "@/types/googleBusiness";

/** The office fields used for the suggested-match heuristic. */
export type OfficeMatchFields = {
  name?: string | null;
  city?: string | null;
  addressLine1?: string | null;
  postalCode?: string | null;
  phone?: string | null;
  website?: string | null;
};

type Props = {
  officeId: string;
  isAdmin: boolean;
  /** The caller's operator role for this office, if any. */
  operatorRole?: GoogleOperatorRole | null;
  /** Office identity, for the suggested-match heuristic only. */
  office?: OfficeMatchFields;
  onChanged?: () => void;
};

function errorMessage(error: unknown): string | undefined {
  return (error as { message?: string } | null)?.message;
}

const STATUS_VARIANT: Record<
  GoogleConnectionStatus,
  "secondary" | "default" | "destructive" | "outline"
> = {
  not_connected: "outline",
  pending: "secondary",
  connected: "default",
  error: "destructive",
  revoked: "outline",
};

type LocationFilter = "all" | "unmapped" | "mapped";

/**
 * Office -> Google Business surface. Phase 1 owns the operator assignment;
 * Phase 3 owns the location mapping (discover -> select -> confirm) and the
 * mapping lifecycle (mapped / remap / disconnect / stale). No Google write
 * happens here — discovery and mapping both run in admin-gated server code.
 */
export default function OfficeGoogleBusinessSection({
  officeId,
  isAdmin,
  operatorRole = null,
  office,
  onChanged,
}: Props) {
  const { t, i18n } = useTranslation("dashboard");
  const { toast } = useToast();

  const [mapping, setMapping] = useState<OfficeGoogleMappingRow | null>(null);
  const [activity, setActivity] = useState<GoogleBusinessActivityRow[]>([]);
  const [candidates, setCandidates] = useState<OfficeGoogleOperatorCandidate[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [primaryChoice, setPrimaryChoice] = useState("");
  const [sideChoice, setSideChoice] = useState("");

  const [discoveryOpen, setDiscoveryOpen] = useState(false);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discovered, setDiscovered] = useState<DiscoveredLocation[]>([]);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<LocationFilter>("all");
  const [selected, setSelected] = useState<DiscoveredLocation | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);

  const runDiscover = useServerFn(discoverGoogleBusinessLocations);
  const runMap = useServerFn(mapOfficeGoogleLocation);
  const runUnmap = useServerFn(unmapOfficeGoogleLocation);

  const canAssignSide = useMemo(
    () =>
      canGoogleOfficeAction(
        { isAdmin, isOfficeMember: true, operatorRole },
        "GOOGLE_ASSIGN_SIDE_MANAGER",
      ),
    [isAdmin, operatorRole],
  );
  const canMap = useMemo(
    () =>
      canGoogleOfficeAction(
        { isAdmin, isOfficeMember: true, operatorRole },
        "GOOGLE_MAP_LOCATION",
      ),
    [isAdmin, operatorRole],
  );

  const load = useCallback(
    async function () {
      setLoading(true);
      try {
        const canListCandidates = canGoogleOfficeAction(
          { isAdmin, isOfficeMember: true, operatorRole },
          "GOOGLE_ASSIGN_SIDE_MANAGER",
        );
        const [mappingRes, activityRes, candidatesRes] = await Promise.all([
          getOfficeGoogleMapping(officeId),
          getGoogleBusinessActivity(officeId, 10),
          canListCandidates
            ? listOfficeGoogleOperatorCandidates(officeId)
            : Promise.resolve({ data: [], error: null }),
        ]);
        if (mappingRes.error) throw mappingRes.error;
        if (activityRes.error) throw activityRes.error;
        if (candidatesRes.error) throw candidatesRes.error;
        setMapping((mappingRes.data || [])[0] || null);
        setActivity(activityRes.data || []);
        setCandidates(candidatesRes.data || []);
      } catch (error) {
        toast({
          variant: "destructive",
          description:
            errorMessage(error) || t("admin.googleBusiness.loadError"),
        });
      } finally {
        setLoading(false);
      }
    },
    [officeId, isAdmin, operatorRole, t, toast],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPrimaryChoice(mapping?.primary_operator_id || "");
    setSideChoice("");
  }, [mapping?.primary_operator_id]);

  const primaryName = mapping?.primary_operator_name || null;
  const sideName = mapping?.side_manager_name || null;
  const status: GoogleConnectionStatus =
    mapping?.connection_status || "not_connected";
  const isMapped =
    mapping?.mapping_status === "MAPPED" &&
    Boolean(mapping?.google_location_id);
  const health = googleSyncHealth(mapping);
  const unavailable =
    status === "error" || mapping?.mapping_status === "MAPPING_ERROR";

  async function runAction(
    action: () => Promise<{ error: unknown }>,
    successKey: string,
  ) {
    setBusy(true);
    try {
      const { error } = await action();
      if (error) throw error;
      toast({ description: t(successKey) });
      await load();
      onChanged?.();
    } catch (error) {
      toast({
        variant: "destructive",
        description:
          errorMessage(error) || t("admin.googleBusiness.actionFailed"),
      });
    } finally {
      setBusy(false);
    }
  }

  function assignPrimary() {
    if (!primaryChoice) return;
    return runAction(
      () => adminAssignGooglePrimary(officeId, primaryChoice),
      "admin.googleBusiness.primarySaved",
    );
  }

  function assignSideManager() {
    if (!sideChoice) return;
    return runAction(
      () => assignGoogleSideManager(officeId, sideChoice),
      "admin.googleBusiness.sideManagerSaved",
    );
  }

  function removeOperator(role: GoogleOperatorRole) {
    return runAction(
      () => removeGoogleOperator(officeId, role),
      "admin.googleBusiness.operatorRemoved",
    );
  }

  async function openDiscovery() {
    setDiscoveryOpen(true);
    setSelected(null);
    setSearch("");
    setFilter("all");
    setDiscoverLoading(true);
    setDiscoveryError(null);
    try {
      const result = await runDiscover({ data: undefined });
      if (result.status === "not_linked") {
        setDiscoveryError(t("admin.googleConnection.notLinked"));
        setDiscovered([]);
      } else if (result.status === "error") {
        setDiscoveryError(
          result.errorMessage || t("admin.googleBusiness.discoveryFailed"),
        );
        setDiscovered([]);
      } else {
        setDiscovered(result.locations);
      }
    } catch (error) {
      setDiscoveryError(
        errorMessage(error) || t("admin.googleBusiness.discoveryFailed"),
      );
    } finally {
      setDiscoverLoading(false);
    }
  }

  async function confirmMapping() {
    if (!selected) return;
    setBusy(true);
    try {
      const result = await runMap({
        data: {
          officeId,
          googleAccountId: selected.accountId,
          googleLocationResourceName: selected.resourceName,
        },
      });
      if (!result.ok) {
        toast({
          variant: "destructive",
          description: result.error || t("admin.googleBusiness.actionFailed"),
        });
        return;
      }
      toast({ description: t("admin.googleBusiness.mappingSuccess") });
      setConfirmOpen(false);
      setDiscoveryOpen(false);
      setSelected(null);
      await load();
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  async function confirmDisconnect() {
    setBusy(true);
    try {
      const result = await runUnmap({ data: { officeId } });
      if (!result.ok) {
        toast({
          variant: "destructive",
          description: result.error || t("admin.googleBusiness.actionFailed"),
        });
        return;
      }
      toast({ description: t("admin.googleBusiness.unmapSuccess") });
      setDisconnectOpen(false);
      await load();
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  const visibleLocations = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return discovered.filter((loc) => {
      if (filter === "unmapped" && loc.mappedOfficeId) return false;
      if (filter === "mapped" && !loc.mappedOfficeId) return false;
      if (!needle) return true;
      return [loc.title, loc.address, loc.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [discovered, search, filter]);

  const selectedMatch = useMemo(() => {
    if (!selected) return null;
    const addressParts = (selected.address ?? "")
      .split(",")
      .map((p) => p.trim());
    return suggestLocationMatch(
      {
        name: office?.name,
        city: office?.city,
        addressLine1: office?.addressLine1,
        postalCode: office?.postalCode,
        phone: office?.phone,
        website: office?.website,
      },
      {
        title: selected.title,
        city: addressParts[2] ?? null,
        phone: selected.phone,
        website: selected.website,
      },
    );
  }, [selected, office]);

  const sideChoices = candidates.filter(
    (member) => member.team_member_id !== mapping?.primary_operator_id,
  );

  return (
    <Card className="rounded-2xl border-border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Link2 className="size-4 text-primary" />
            {t("admin.googleBusiness.title")}
          </CardTitle>
          <div className="flex items-center gap-2">
            {isMapped ? (
              <Badge
                variant={
                  health === "Healthy"
                    ? "default"
                    : health === "Error"
                      ? "destructive"
                      : "secondary"
                }
              >
                {t(`admin.googleBusiness.health.${health}`)}
              </Badge>
            ) : null}
            <Badge variant={STATUS_VARIANT[status]}>
              {t(`admin.googleBusiness.status.${status}`)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <p className="text-sm text-muted-foreground">
            {t("admin.googleBusiness.loading")}
          </p>
        ) : (
          <>
            {/* ---- Mapping: mapped / unavailable / not connected ---- */}
            <section className="space-y-3 rounded-xl border border-border p-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="size-4 text-primary" />
                {t("admin.googleBusiness.profile")}
              </div>

              {unavailable ? (
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-sm font-medium text-destructive">
                    <AlertTriangle className="size-4" />
                    {t("admin.googleBusiness.unavailableTitle")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {mapping?.last_error_message ||
                      t("admin.googleBusiness.unavailableDesc")}
                  </p>
                  {canMap ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={openDiscovery}
                    >
                      <RefreshCw className="me-2 size-4" />
                      {t("admin.googleBusiness.recheck")}
                    </Button>
                  ) : null}
                </div>
              ) : isMapped ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">
                      {mapping?.google_location_name ||
                        mapping?.google_location_id}
                    </span>
                    {mapping?.google_verification_state ? (
                      <Badge variant="outline">
                        {mapping.google_verification_state}
                      </Badge>
                    ) : null}
                  </div>
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                    {mapping?.google_address_line_1 || mapping?.google_city ? (
                      <div className="min-w-0">
                        <dt className="text-xs text-muted-foreground">
                          {t("admin.googleBusiness.addressLabel")}
                        </dt>
                        <dd className="break-words">
                          {[
                            mapping?.google_address_line_1,
                            mapping?.google_postal_code,
                            mapping?.google_city,
                            mapping?.google_country,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </dd>
                      </div>
                    ) : null}
                    {mapping?.google_primary_category ? (
                      <div className="min-w-0">
                        <dt className="text-xs text-muted-foreground">
                          {t("admin.googleBusiness.categoryLabel")}
                        </dt>
                        <dd className="truncate">
                          {mapping.google_primary_category}
                        </dd>
                      </div>
                    ) : null}
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">
                        {t("admin.googleBusiness.googleLocation")}
                      </dt>
                      <dd className="truncate">
                        {mapping?.google_location_id}
                      </dd>
                    </div>
                    {mapping?.mapped_at ? (
                      <div className="min-w-0">
                        <dt className="text-xs text-muted-foreground">
                          {t("admin.googleBusiness.mappedAt")}
                        </dt>
                        <dd>
                          {new Date(mapping.mapped_at).toLocaleString(
                            i18n.language,
                          )}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                  <div className="flex flex-wrap gap-2">
                    {mapping?.google_maps_url ? (
                      <Button asChild size="sm" variant="outline">
                        <a
                          href={mapping.google_maps_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ExternalLink className="me-2 size-4" />
                          {t("admin.googleBusiness.openMaps")}
                        </a>
                      </Button>
                    ) : null}
                    {canMap ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={openDiscovery}
                          disabled={busy}
                        >
                          {t("admin.googleBusiness.changeLocation")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setDisconnectOpen(true)}
                          disabled={busy}
                        >
                          <Trash2 className="me-2 size-4" />
                          {t("admin.googleBusiness.disconnect")}
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    {t("admin.googleBusiness.notConnectedTitle")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("admin.googleBusiness.notConnectedDesc")}
                  </p>
                  {canMap ? (
                    <Button type="button" size="sm" onClick={openDiscovery}>
                      <Search className="me-2 size-4" />
                      {t("admin.googleBusiness.findLocation")}
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {t("admin.googleBusiness.adminOnlyNote")}
                    </p>
                  )}
                </div>
              )}
            </section>

            {/* ---- Operators (Phase 1) ---- */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Users className="size-4 text-primary" />
                {t("admin.googleBusiness.operators")}
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="min-w-0 space-y-2">
                  <Label>{t("admin.googleBusiness.primaryOperator")}</Label>
                  <p className="truncate text-sm font-medium">
                    {primaryName || t("admin.googleBusiness.notAssigned")}
                  </p>
                  {primaryName && mapping?.primary_is_active === false ? (
                    <p className="flex items-center gap-1.5 text-xs text-destructive">
                      <AlertTriangle className="size-3.5 shrink-0" />
                      {t("admin.googleBusiness.operatorInactive")}
                    </p>
                  ) : null}
                  {isAdmin ? (
                    <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-[1fr_auto]">
                      <Select
                        value={primaryChoice || "none"}
                        onValueChange={(v) =>
                          setPrimaryChoice(v === "none" ? "" : v)
                        }
                      >
                        <SelectTrigger className="min-w-0">
                          <SelectValue
                            placeholder={t("admin.googleBusiness.selectMember")}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            {t("admin.googleBusiness.notAssigned")}
                          </SelectItem>
                          {candidates.map((member) => (
                            <SelectItem
                              key={member.team_member_id}
                              value={member.team_member_id}
                            >
                              {member.full_name || member.team_member_id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        size="sm"
                        onClick={assignPrimary}
                        disabled={busy || !primaryChoice}
                      >
                        {busy ? (
                          <Clock3 className="me-2 size-4 animate-spin" />
                        ) : (
                          <UserPlus className="me-2 size-4" />
                        )}
                        {t("admin.googleBusiness.change")}
                      </Button>
                    </div>
                  ) : null}
                  {isAdmin && primaryName ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeOperator("PRIMARY")}
                      disabled={busy}
                    >
                      <Trash2 className="me-2 size-4" />
                      {t("admin.googleBusiness.remove")}
                    </Button>
                  ) : null}
                </div>

                <div className="min-w-0 space-y-2">
                  <Label>{t("admin.googleBusiness.sideManager")}</Label>
                  <p className="truncate text-sm font-medium">
                    {sideName || t("admin.googleBusiness.notAssigned")}
                  </p>
                  {sideName && mapping?.side_manager_is_active === false ? (
                    <p className="flex items-center gap-1.5 text-xs text-destructive">
                      <AlertTriangle className="size-3.5 shrink-0" />
                      {t("admin.googleBusiness.operatorInactive")}
                    </p>
                  ) : null}
                  {canAssignSide ? (
                    <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-[1fr_auto]">
                      <Select
                        value={sideChoice || "none"}
                        onValueChange={(v) =>
                          setSideChoice(v === "none" ? "" : v)
                        }
                      >
                        <SelectTrigger className="min-w-0">
                          <SelectValue
                            placeholder={t("admin.googleBusiness.selectMember")}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">
                            {t("admin.googleBusiness.notAssigned")}
                          </SelectItem>
                          {sideChoices.map((member) => (
                            <SelectItem
                              key={member.team_member_id}
                              value={member.team_member_id}
                            >
                              {member.full_name || member.team_member_id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        size="sm"
                        onClick={assignSideManager}
                        disabled={busy || !sideChoice}
                      >
                        {busy ? (
                          <Clock3 className="me-2 size-4 animate-spin" />
                        ) : (
                          <UserPlus className="me-2 size-4" />
                        )}
                        {sideName
                          ? t("admin.googleBusiness.change")
                          : t("admin.googleBusiness.addSideManager")}
                      </Button>
                    </div>
                  ) : null}
                  {canAssignSide && sideName ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeOperator("SIDE_MANAGER")}
                      disabled={busy}
                    >
                      <Trash2 className="me-2 size-4" />
                      {t("admin.googleBusiness.remove")}
                    </Button>
                  ) : null}
                </div>
              </div>
            </section>

            {/* ---- Audit ---- */}
            <section className="space-y-2">
              <div className="text-sm font-semibold">
                {t("admin.googleBusiness.audit.title")}
              </div>
              {activity.length ? (
                <ul className="space-y-1">
                  {activity.map((entry) => (
                    <li
                      key={entry.id}
                      className="grid grid-cols-1 gap-1 rounded-lg border border-border p-2 text-xs sm:grid-cols-[1fr_auto] sm:items-center"
                    >
                      <span className="min-w-0 truncate">
                        {t(
                          `admin.googleBusiness.auditAction.${entry.action}`,
                          entry.action,
                        )}
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(entry.created_at).toLocaleString(
                          i18n.language,
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("admin.googleBusiness.audit.empty")}
                </p>
              )}
            </section>
          </>
        )}
      </CardContent>

      {/* ---- Location discovery dialog ---- */}
      <Dialog open={discoveryOpen} onOpenChange={setDiscoveryOpen}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {t("admin.googleBusiness.findLocationTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("admin.googleBusiness.findLocationDesc")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="ps-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("admin.googleBusiness.searchLocations")}
                />
              </div>
              <Select
                value={filter}
                onValueChange={(v) => setFilter(v as LocationFilter)}
              >
                <SelectTrigger className="min-w-0 sm:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("admin.googleBusiness.filterAll")}
                  </SelectItem>
                  <SelectItem value="unmapped">
                    {t("admin.googleBusiness.filterUnmapped")}
                  </SelectItem>
                  <SelectItem value="mapped">
                    {t("admin.googleBusiness.filterMapped")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {discoverLoading ? (
              <p className="text-sm text-muted-foreground">
                {t("admin.googleBusiness.discovering")}
              </p>
            ) : discoveryError ? (
              <p className="text-sm text-destructive">{discoveryError}</p>
            ) : visibleLocations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("admin.googleBusiness.noLocations")}
              </p>
            ) : (
              <ul className="space-y-2">
                {visibleLocations.map((loc) => {
                  const mappedElsewhere = Boolean(loc.mappedOfficeId);
                  return (
                    <li
                      key={loc.resourceName}
                      className="grid grid-cols-1 gap-2 rounded-xl border border-border p-3 sm:grid-cols-[1fr_auto] sm:items-center"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-medium">
                            {loc.title || loc.locationId}
                          </span>
                          {loc.verificationState ? (
                            <Badge variant="outline">
                              {loc.verificationState}
                            </Badge>
                          ) : null}
                          {mappedElsewhere ? (
                            <Badge variant="secondary">
                              {t("admin.googleBusiness.mappedTo", {
                                office: loc.mappedOfficeName || "",
                              })}
                            </Badge>
                          ) : null}
                        </div>
                        {loc.address ? (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {loc.address}
                          </p>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={mappedElsewhere}
                        onClick={() => {
                          setSelected(loc);
                          setConfirmOpen(false);
                        }}
                      >
                        {t("admin.googleBusiness.select")}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* ---- Detail preview (never map from a name alone) ---- */}
            {selected ? (
              <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">
                    {selected.title || selected.locationId}
                  </span>
                  {selectedMatch?.suggested ? (
                    <Badge>
                      {t("admin.googleBusiness.suggestedMatch")}
                      {` · ${selectedMatch.score}%`}
                    </Badge>
                  ) : null}
                </div>
                <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">
                      {t("admin.googleBusiness.businessName")}
                    </dt>
                    <dd className="break-words">{selected.title || "—"}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">
                      {t("admin.googleBusiness.addressLabel")}
                    </dt>
                    <dd className="break-words">{selected.address || "—"}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">
                      {t("admin.googleBusiness.phoneLabel")}
                    </dt>
                    <dd className="truncate">{selected.phone || "—"}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">
                      {t("admin.googleBusiness.categoryLabel")}
                    </dt>
                    <dd className="truncate">{selected.category || "—"}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">
                      {t("admin.googleBusiness.googleLocation")}
                    </dt>
                    <dd className="truncate">{selected.locationId}</dd>
                  </div>
                </dl>

                {selectedMatch ? (
                  <div className="space-y-1 text-xs">
                    {selectedMatch.signals
                      .filter((s) => s.matched)
                      .map((s) => (
                        <span
                          key={s.key}
                          className="me-3 inline-flex items-center gap-1 text-emerald-700"
                        >
                          <CheckCircle2 className="size-3.5" />
                          {t(`admin.googleBusiness.matchSignals.${s.key}`)}
                        </span>
                      ))}
                    <p className="text-muted-foreground">
                      {t("admin.googleBusiness.matchHeuristicNote")}
                    </p>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {selected.mapsUrl ? (
                    <Button asChild size="sm" variant="outline">
                      <a
                        href={selected.mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <MapPin className="me-2 size-4" />
                        {t("admin.googleBusiness.openMaps")}
                      </a>
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    disabled={Boolean(selected.mappedOfficeId)}
                    onClick={() => setConfirmOpen(true)}
                  >
                    {t("admin.googleBusiness.selectThisLocation")}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDiscoveryOpen(false)}
            >
              {t("admin.googleBusiness.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Confirmation dialog ---- */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("admin.googleBusiness.confirmTitle")}</DialogTitle>
            <DialogDescription>
              {t("admin.googleBusiness.confirmBody")}
            </DialogDescription>
          </DialogHeader>
          {selected ? (
            <dl className="grid grid-cols-1 gap-y-2 text-sm">
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">
                  {t("admin.googleBusiness.businessName")}
                </dt>
                <dd className="break-words">
                  {selected.title || selected.locationId}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">
                  {t("admin.googleBusiness.addressLabel")}
                </dt>
                <dd className="break-words">{selected.address || "—"}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">
                  {t("admin.googleBusiness.googleAccount")}
                </dt>
                <dd className="truncate">{selected.accountId}</dd>
              </div>
            </dl>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={busy}
            >
              {t("admin.googleBusiness.cancel")}
            </Button>
            <Button type="button" onClick={confirmMapping} disabled={busy}>
              {busy ? <Clock3 className="me-2 size-4 animate-spin" /> : null}
              {t("admin.googleBusiness.confirmConnection")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Disconnect dialog ---- */}
      <Dialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t("admin.googleBusiness.disconnectTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("admin.googleBusiness.disconnectBody")}
            </DialogDescription>
          </DialogHeader>
          <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            {t("admin.googleBusiness.disconnectNote")}
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDisconnectOpen(false)}
              disabled={busy}
            >
              {t("admin.googleBusiness.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDisconnect}
              disabled={busy}
            >
              {busy ? <Clock3 className="me-2 size-4 animate-spin" /> : null}
              {t("admin.googleBusiness.disconnectConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
