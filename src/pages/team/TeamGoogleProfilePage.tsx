import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useOfficeWorkspaceSelection } from "@/lib/officeWorkspace";
import type { TFunction } from "i18next";
import {
  AlertTriangle,
  Building2,
  Check,
  Clock3,
  ExternalLink,
  Globe,
  Loader2,
  MapPin,
  Phone,
  RefreshCw,
  Save,
  ShieldAlert,
  ShieldCheck,
  Store,
  Tags,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  decideGoogleProfileChangeRequest,
  getOfficeGoogleProfile,
  listGoogleProfileChangeRequests,
  listMyGoogleOffices,
  submitGoogleProfileChangeRequest,
} from "@/lib/googleBusinessApi";
import {
  publishGoogleChangeRequest,
  syncGoogleProfile,
  updateGoogleProfile,
} from "@/lib/googleBusinessProfile.functions";
import { useServerFn } from "@tanstack/react-start";
import {
  GBP_DESCRIPTION_MAX_BYTES,
  GBP_MAX_ADDITIONAL_CATEGORIES,
  GBP_WEEKDAYS,
  byteLength,
  invalidHoursDay,
  isValidPhone,
  isValidWebsite,
  type GbpRegularHours,
  type GbpWeekday,
} from "@/lib/googleBusinessGateway";
import type {
  GoogleChangeRequestField,
  GoogleProfileChangeRequestRow,
  MyGoogleOfficeRow,
  OfficeGoogleProfileDetailRow,
} from "@/types/googleBusiness";
import { googleProfileHealth } from "@/types/googleBusiness";

type Draft = {
  business_name: string;
  business_description: string;
  website_url: string;
  phone_primary: string;
  phone_additional: string[];
  additional_categories: string[];
  regular_hours: GbpRegularHours | null;
};

function toDraft(row: OfficeGoogleProfileDetailRow): Draft {
  return {
    business_name: row.business_name ?? "",
    business_description: row.business_description ?? "",
    website_url: row.website_url ?? "",
    phone_primary: row.phone_primary ?? "",
    phone_additional: row.phone_additional ?? [],
    additional_categories: row.additional_categories ?? [],
    regular_hours: row.regular_hours ?? null,
  };
}

/** The low/medium-risk fields a Primary or Side Manager may publish directly. */
function draftChanges(row: OfficeGoogleProfileDetailRow, draft: Draft) {
  const changes: Record<string, unknown> = {};
  if (draft.business_name !== (row.business_name ?? ""))
    changes.business_name = draft.business_name.trim();
  if (draft.business_description !== (row.business_description ?? ""))
    changes.business_description = draft.business_description.trim();
  if (draft.website_url !== (row.website_url ?? ""))
    changes.website_url = draft.website_url.trim();
  if (draft.phone_primary !== (row.phone_primary ?? ""))
    changes.phone_primary = draft.phone_primary.trim();
  if (
    JSON.stringify(draft.phone_additional) !==
    JSON.stringify(row.phone_additional ?? [])
  )
    changes.phone_additional = draft.phone_additional
      .map((p) => p.trim())
      .filter(Boolean);
  if (
    JSON.stringify(draft.additional_categories) !==
    JSON.stringify(row.additional_categories ?? [])
  )
    changes.additional_categories = draft.additional_categories
      .map((c) => c.trim())
      .filter(Boolean);
  if (
    JSON.stringify(draft.regular_hours) !==
    JSON.stringify(row.regular_hours ?? null)
  )
    changes.regular_hours = draft.regular_hours;
  return changes;
}

function validateDraft(draft: Draft, t: TFunction<"dashboard">): string[] {
  const errors: string[] = [];
  if (!draft.business_name.trim()) errors.push(t("googleProfile.errName"));
  if (byteLength(draft.business_description.trim()) > GBP_DESCRIPTION_MAX_BYTES)
    errors.push(t("googleProfile.errDescription"));
  if (draft.website_url.trim() && !isValidWebsite(draft.website_url))
    errors.push(t("googleProfile.errWebsite"));
  if (draft.phone_primary.trim() && !isValidPhone(draft.phone_primary))
    errors.push(t("googleProfile.errPhone"));
  for (const p of draft.phone_additional) {
    if (p.trim() && !isValidPhone(p)) {
      errors.push(t("googleProfile.errPhone"));
      break;
    }
  }
  if (invalidHoursDay(draft.regular_hours))
    errors.push(t("googleProfile.errHours"));
  return errors;
}

function formatValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (Array.isArray(value)) return value.join(", ") || "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** One inline-editable text field with a change highlight. */
function EditableField({
  label,
  value,
  original,
  onChange,
  disabled,
  type = "text",
  dir,
  placeholder,
}: {
  label: string;
  value: string;
  original: string | null;
  onChange: (v: string) => void;
  disabled?: boolean;
  type?: string;
  dir?: "ltr" | "rtl";
  placeholder?: string;
}) {
  const changed = value !== (original ?? "");
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {label}
        {changed && (
          <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
        )}
      </Label>
      <Input
        type={type}
        dir={dir}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={changed ? "border-amber-400/60" : undefined}
      />
    </div>
  );
}

function HealthBadge({
  row,
  t,
}: {
  row: OfficeGoogleProfileDetailRow | null;
  t: TFunction<"dashboard">;
}) {
  const health = googleProfileHealth(row);
  const map = {
    Healthy: {
      icon: ShieldCheck,
      className: "border-emerald-500/40 text-emerald-600",
      key: "googleProfile.health.healthy",
    },
    NeedsAttention: {
      icon: AlertTriangle,
      className: "border-amber-500/40 text-amber-600",
      key: "googleProfile.health.attention",
    },
    Disconnected: {
      icon: ShieldAlert,
      className: "border-destructive/40 text-destructive",
      key: "googleProfile.health.disconnected",
    },
    Unavailable: {
      icon: ShieldAlert,
      className: "border-muted-foreground/30 text-muted-foreground",
      key: "googleProfile.health.unavailable",
    },
  } as const;
  const entry = map[health];
  const Icon = entry.icon;
  return (
    <Badge variant="outline" className={`gap-1.5 ${entry.className}`}>
      <Icon className="size-3.5" />
      {t(entry.key)}
    </Badge>
  );
}

/**
 * The Google Business Profile editor (Phase 6).
 *
 * Google is the source of truth: the page reads DARB's mirror of the Google
 * location and writes edits back through the connector. Low/medium-risk fields
 * are published directly by an operator; high-risk fields (category, address)
 * are routed through an Admin-approved change request. Every write is
 * version-guarded and audited server-side.
 */
export default function TeamGoogleProfilePage() {
  const { t } = useTranslation("dashboard");
  const { toast } = useToast();
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const [offices, setOffices] = useState<MyGoogleOfficeRow[]>([]);
  // Office context from the canonical office route (or legacy ?office=slug).
  const { officeId: workspaceOfficeId } = useOfficeWorkspaceSelection();
  const [officeId, setOfficeId] = useState<string | null>(null);
  const [profile, setProfile] = useState<OfficeGoogleProfileDetailRow | null>(
    null,
  );
  const [requests, setRequests] = useState<GoogleProfileChangeRequestRow[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const [requestField, setRequestField] =
    useState<GoogleChangeRequestField | null>(null);
  const [requestReason, setRequestReason] = useState("");
  const [requestCategory, setRequestCategory] = useState("");
  const [requestAddress, setRequestAddress] = useState<Record<string, string>>(
    {},
  );
  const [decideTarget, setDecideTarget] =
    useState<GoogleProfileChangeRequestRow | null>(null);

  const runSync = useServerFn(syncGoogleProfile);
  const runUpdate = useServerFn(updateGoogleProfile);
  const runPublishRequest = useServerFn(publishGoogleChangeRequest);

  const activeOffice = useMemo(
    () => offices.find((o) => o.office_id === officeId) ?? null,
    [offices, officeId],
  );
  const operatorRole = activeOffice?.operator_role ?? null;
  const canEdit =
    isAdmin || operatorRole === "PRIMARY" || operatorRole === "SIDE_MANAGER";

  const loadOffices = useCallback(async () => {
    const { data, error } = await listMyGoogleOffices();
    if (error) {
      toast({ variant: "destructive", description: error.message });
      return;
    }
    const list = data || [];
    setOffices(list);
    setOfficeId(
      (current) =>
        current ??
        (workspaceOfficeId && list.some((o) => o.office_id === workspaceOfficeId)
          ? workspaceOfficeId
          : (list[0]?.office_id ?? null)),
    );
  }, [toast, workspaceOfficeId]);

  useEffect(() => {
    loadOffices();
  }, [loadOffices]);

  // Follow the URL's office when it changes (e.g. navigating between offices).
  useEffect(() => {
    if (
      workspaceOfficeId &&
      offices.some((o) => o.office_id === workspaceOfficeId)
    ) {
      setOfficeId(workspaceOfficeId);
    }
  }, [workspaceOfficeId, offices]);

  const load = useCallback(async () => {
    if (!officeId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [profileRes, requestsRes] = await Promise.all([
        getOfficeGoogleProfile(officeId),
        listGoogleProfileChangeRequests(officeId),
      ]);
      if (profileRes.error) throw profileRes.error;
      const row = (profileRes.data || [])[0] ?? null;
      setProfile(row);
      setDraft(row ? toDraft(row) : null);
      setRequests(requestsRes.data || []);
    } catch (error) {
      toast({
        variant: "destructive",
        description: (error as { message?: string })?.message,
      });
    } finally {
      setLoading(false);
    }
  }, [officeId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const changes = useMemo(
    () => (profile && draft ? draftChanges(profile, draft) : {}),
    [profile, draft],
  );
  const changedFields = Object.keys(changes);
  const errors = useMemo(
    () => (draft ? validateDraft(draft, t) : []),
    [draft, t],
  );

  async function handleSync() {
    if (!officeId || busy) return;
    setBusy(true);
    try {
      const result = await runSync({ data: { officeId } });
      if (result.status === "synced") {
        toast({ description: t("googleProfile.synced") });
        await load();
      } else if (result.status === "unchanged") {
        toast({ description: t("googleProfile.alreadyCurrent") });
      } else if (result.status === "external_change") {
        toast({
          variant: "destructive",
          description: t("googleProfile.externalChange"),
        });
        await load();
      } else if (result.status === "locked") {
        toast({ description: t("googleProfile.syncInProgress") });
      } else {
        toast({
          variant: "destructive",
          description: result.errorMessage || t("googleProfile.syncFailed"),
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        description:
          (error as { message?: string })?.message ||
          t("googleProfile.syncFailed"),
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!officeId || !profile || busy) return;
    if (errors.length) {
      toast({ variant: "destructive", description: errors[0] });
      return;
    }
    if (!changedFields.length) return;
    setBusy(true);
    try {
      const result = await runUpdate({
        data: {
          officeId,
          fields: changes,
          expectedVersion: profile.profile_version,
          idempotencyKey: `profile:${officeId}:${Date.now()}`,
        },
      });
      if (result.ok) {
        toast({ description: t("googleProfile.saved") });
        setConfirmSave(false);
        await load();
      } else if (result.status === "conflict") {
        toast({
          variant: "destructive",
          description: t("googleProfile.versionConflict"),
        });
        await load();
      } else if (result.status === "uncertain") {
        toast({
          variant: "destructive",
          description: t("googleProfile.uncertain"),
        });
      } else {
        toast({
          variant: "destructive",
          description: result.errorMessage || t("googleProfile.saveFailed"),
        });
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitRequest() {
    if (!officeId || !requestField || busy) return;
    setBusy(true);
    try {
      const value: Record<string, unknown> =
        requestField === "PRIMARY_CATEGORY"
          ? { primary_category: requestCategory.trim() }
          : requestAddress;
      const { error } = await submitGoogleProfileChangeRequest(
        officeId,
        requestField,
        value,
        requestReason,
      );
      if (error) throw error;
      toast({ description: t("googleProfile.requestSubmitted") });
      setRequestField(null);
      setRequestReason("");
      setRequestCategory("");
      setRequestAddress({});
      await load();
    } catch (error) {
      toast({
        variant: "destructive",
        description:
          (error as { message?: string })?.message ||
          t("googleProfile.requestFailed"),
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleDecide(
    request: GoogleProfileChangeRequestRow,
    decision: "APPROVED" | "REJECTED",
  ) {
    if (!officeId || busy) return;
    setBusy(true);
    try {
      const { error } = await decideGoogleProfileChangeRequest(
        officeId,
        request.id,
        decision,
        null,
      );
      if (error) throw error;
      if (decision === "APPROVED") {
        // Approval only marks the request; publishing to Google is a separate,
        // observable step so a Google failure does not look like a success.
        const published = await runPublishRequest({
          data: { officeId, requestId: request.id },
        });
        toast({
          description: published.ok
            ? t("googleProfile.requestPublished")
            : t("googleProfile.requestPublishFailed"),
          variant: published.ok ? undefined : "destructive",
        });
      } else {
        toast({ description: t("googleProfile.requestRejected") });
      }
      setDecideTarget(null);
      await load();
    } catch (error) {
      toast({
        variant: "destructive",
        description:
          (error as { message?: string })?.message ||
          t("googleProfile.requestFailed"),
      });
    } finally {
      setBusy(false);
    }
  }

  if (!loading && offices.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 pt-4 sm:px-6">
        <Card className="rounded-2xl border-border shadow-sm">
          <CardContent className="space-y-2 py-10 text-center">
            <ShieldAlert className="mx-auto size-8 text-muted-foreground" />
            <p className="text-sm font-medium">
              {t("googleProfile.noOfficeTitle")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("googleProfile.noOfficeDesc")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const notMapped =
    profile &&
    (profile.mapping_status !== "MAPPED" ||
      profile.connection_status !== "connected");

  const pending = requests.filter((r) => r.status === "PENDING");

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 pt-4 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Store className="size-5 text-emerald-600" />
            {t("googleProfile.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("googleProfile.subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <HealthBadge row={profile} t={t} />
          {offices.length > 1 && (
            <Select value={officeId ?? undefined} onValueChange={setOfficeId}>
              <SelectTrigger className="w-[190px]">
                <Building2 className="size-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {offices.map((o) => (
                  <SelectItem key={o.office_id} value={o.office_id}>
                    {o.office_name || t("googleProfile.officeFallback")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={busy || !officeId || !canEdit}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            {t("googleProfile.syncNow")}
          </Button>
        </div>
      </header>

      {loading ? (
        <ProfileSkeleton />
      ) : notMapped ? (
        <Card className="rounded-2xl">
          <CardContent className="space-y-2 py-10 text-center">
            <AlertTriangle className="mx-auto size-8 text-amber-500" />
            <p className="text-sm font-medium">
              {t("googleProfile.notMappedTitle")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("googleProfile.notMappedDesc")}
            </p>
          </CardContent>
        </Card>
      ) : profile && draft ? (
        <Tabs defaultValue="profile" className="space-y-4">
          <TabsList>
            <TabsTrigger value="profile">
              {t("googleProfile.tabProfile")}
            </TabsTrigger>
            <TabsTrigger value="requests" className="gap-1.5">
              {t("googleProfile.tabRequests")}
              {pending.length > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5">
                  {pending.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            <IdentityCard
              profile={profile}
              draft={draft}
              setDraft={setDraft}
              disabled={!canEdit}
              t={t}
            />
            <ContactCard
              profile={profile}
              draft={draft}
              setDraft={setDraft}
              disabled={!canEdit}
              t={t}
            />
            <CategoryCard
              profile={profile}
              draft={draft}
              setDraft={setDraft}
              disabled={!canEdit}
              onRequest={() => {
                setRequestCategory(profile.primary_category ?? "");
                setRequestField("PRIMARY_CATEGORY");
              }}
              t={t}
            />
            <AddressCard
              profile={profile}
              onRequest={() => {
                setRequestAddress({
                  address_line_1: profile.address_line_1 ?? "",
                  address_line_2: profile.address_line_2 ?? "",
                  postal_code: profile.postal_code ?? "",
                  city: profile.city ?? "",
                  region: profile.region ?? "",
                  country: profile.country ?? "",
                });
                setRequestField("ADDRESS");
              }}
              t={t}
            />
            <HoursCard
              draft={draft}
              setDraft={setDraft}
              disabled={!canEdit}
              t={t}
            />

            {canEdit && (
              <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-xl border bg-background/95 p-3 shadow-sm backdrop-blur">
                <p className="text-sm text-muted-foreground">
                  {changedFields.length
                    ? t("googleProfile.unsaved", {
                        count: changedFields.length,
                      })
                    : t("googleProfile.noChanges")}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!changedFields.length || busy}
                    onClick={() => profile && setDraft(toDraft(profile))}
                  >
                    {t("googleProfile.discard")}
                  </Button>
                  <Button
                    size="sm"
                    disabled={
                      !changedFields.length || busy || errors.length > 0
                    }
                    onClick={() => setConfirmSave(true)}
                  >
                    {busy ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Save className="size-4" />
                    )}
                    {t("googleProfile.save")}
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="requests" className="space-y-3">
            <RequestList
              requests={requests}
              isAdmin={isAdmin}
              busy={busy}
              onDecide={(r) => setDecideTarget(r)}
              t={t}
            />
          </TabsContent>
        </Tabs>
      ) : null}

      {/* Save confirmation — publishes to Google. */}
      <AlertDialog open={confirmSave} onOpenChange={setConfirmSave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("googleProfile.confirmSaveTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("googleProfile.confirmSaveDesc", {
                count: changedFields.length,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-48 space-y-1 overflow-auto rounded-lg border bg-muted/40 p-3 text-sm">
            {changedFields.map((f) => (
              <div key={f} className="flex justify-between gap-3">
                <span className="text-muted-foreground">
                  {t(`googleProfile.field.${f}`, f)}
                </span>
                <span className="truncate font-medium">
                  {formatValue(changes[f])}
                </span>
              </div>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("googleProfile.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleSave} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {t("googleProfile.confirmPublish")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* High-risk change request dialog. */}
      <AlertDialog
        open={requestField !== null}
        onOpenChange={(open) => !open && setRequestField(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("googleProfile.requestTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("googleProfile.requestDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {requestField === "PRIMARY_CATEGORY" ? (
            <div className="space-y-1.5">
              <Label>{t("googleProfile.field.primary_category")}</Label>
              <Input
                value={requestCategory}
                onChange={(e) => setRequestCategory(e.target.value)}
                placeholder={profile?.primary_category ?? ""}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(
                [
                  "address_line_1",
                  "address_line_2",
                  "postal_code",
                  "city",
                  "region",
                  "country",
                ] as const
              ).map((key) => (
                <div key={key} className="space-y-1.5">
                  <Label>{t(`googleProfile.field.${key}`)}</Label>
                  <Input
                    value={requestAddress[key] ?? ""}
                    onChange={(e) =>
                      setRequestAddress((prev) => ({
                        ...prev,
                        [key]: e.target.value,
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          )}
          <div className="space-y-1.5">
            <Label>{t("googleProfile.reason")}</Label>
            <Textarea
              value={requestReason}
              onChange={(e) => setRequestReason(e.target.value)}
              rows={2}
              placeholder={t("googleProfile.reasonPlaceholder")}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("googleProfile.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmitRequest} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {t("googleProfile.submitRequest")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Admin approve/reject confirmation. */}
      <AlertDialog
        open={decideTarget !== null}
        onOpenChange={(open) => !open && setDecideTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("googleProfile.decideTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("googleProfile.decideDesc", {
                field: decideTarget
                  ? t(
                      `googleProfile.requestField.${decideTarget.field}`,
                      decideTarget.field,
                    )
                  : "",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {decideTarget && (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <p className="text-muted-foreground">
                {t("googleProfile.requestedBy", {
                  name: decideTarget.requested_by_name || "—",
                })}
              </p>
              <p className="mt-1 font-medium">
                {formatValue(decideTarget.requested_value)}
              </p>
            </div>
          )}
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>{t("googleProfile.cancel")}</AlertDialogCancel>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                decideTarget && handleDecide(decideTarget, "REJECTED")
              }
            >
              <X className="size-4" />
              {t("googleProfile.reject")}
            </Button>
            <AlertDialogAction
              disabled={busy}
              onClick={() =>
                decideTarget && handleDecide(decideTarget, "APPROVED")
              }
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              {t("googleProfile.approve")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: React.ElementType;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4 text-muted-foreground" />
          {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

function IdentityCard({
  profile,
  draft,
  setDraft,
  disabled,
  t,
}: {
  profile: OfficeGoogleProfileDetailRow;
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft | null>>;
  disabled: boolean;
  t: TFunction<"dashboard">;
}) {
  const descBytes = byteLength(draft.business_description.trim());
  return (
    <SectionCard icon={Store} title={t("googleProfile.sectionIdentity")}>
      <EditableField
        label={t("googleProfile.field.business_name")}
        value={draft.business_name}
        original={profile.business_name}
        disabled={disabled}
        onChange={(v) => setDraft((d) => (d ? { ...d, business_name: v } : d))}
      />
      <div className="space-y-1.5">
        <Label className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{t("googleProfile.field.business_description")}</span>
          <span
            className={
              descBytes > GBP_DESCRIPTION_MAX_BYTES
                ? "text-destructive"
                : undefined
            }
          >
            {descBytes}/{GBP_DESCRIPTION_MAX_BYTES}
          </span>
        </Label>
        <Textarea
          value={draft.business_description}
          disabled={disabled}
          rows={3}
          onChange={(e) =>
            setDraft((d) =>
              d ? { ...d, business_description: e.target.value } : d,
            )
          }
        />
      </div>
      <EditableField
        label={t("googleProfile.field.website_url")}
        value={draft.website_url}
        original={profile.website_url}
        disabled={disabled}
        dir="ltr"
        placeholder="https://"
        onChange={(v) => setDraft((d) => (d ? { ...d, website_url: v } : d))}
      />
      {profile.google_maps_url && (
        <a
          href={profile.google_maps_url}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <ExternalLink className="size-3.5" />
          {t("googleProfile.viewOnGoogle")}
        </a>
      )}
    </SectionCard>
  );
}

function ContactCard({
  profile,
  draft,
  setDraft,
  disabled,
  t,
}: {
  profile: OfficeGoogleProfileDetailRow;
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft | null>>;
  disabled: boolean;
  t: TFunction<"dashboard">;
}) {
  return (
    <SectionCard icon={Phone} title={t("googleProfile.sectionContact")}>
      <EditableField
        label={t("googleProfile.field.phone_primary")}
        value={draft.phone_primary}
        original={profile.phone_primary}
        disabled={disabled}
        dir="ltr"
        onChange={(v) => setDraft((d) => (d ? { ...d, phone_primary: v } : d))}
      />
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">
          {t("googleProfile.field.phone_additional")}
        </Label>
        {draft.phone_additional.map((phone, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              dir="ltr"
              value={phone}
              disabled={disabled}
              onChange={(e) =>
                setDraft((d) => {
                  if (!d) return d;
                  const next = [...d.phone_additional];
                  next[index] = e.target.value;
                  return { ...d, phone_additional: next };
                })
              }
            />
            {!disabled && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("googleProfile.remove")}
                onClick={() =>
                  setDraft((d) =>
                    d
                      ? {
                          ...d,
                          phone_additional: d.phone_additional.filter(
                            (_, i) => i !== index,
                          ),
                        }
                      : d,
                  )
                }
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
        ))}
        {!disabled && draft.phone_additional.length < 3 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setDraft((d) =>
                d ? { ...d, phone_additional: [...d.phone_additional, ""] } : d,
              )
            }
          >
            {t("googleProfile.addPhone")}
          </Button>
        )}
      </div>
    </SectionCard>
  );
}

function CategoryCard({
  profile,
  draft,
  setDraft,
  disabled,
  onRequest,
  t,
}: {
  profile: OfficeGoogleProfileDetailRow;
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft | null>>;
  disabled: boolean;
  onRequest: () => void;
  t: TFunction<"dashboard">;
}) {
  return (
    <SectionCard
      icon={Tags}
      title={t("googleProfile.sectionCategory")}
      action={
        !disabled && (
          <Button variant="outline" size="sm" onClick={onRequest}>
            {t("googleProfile.requestChange")}
          </Button>
        )
      }
    >
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {t("googleProfile.field.primary_category")}
          <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
            {t("googleProfile.highRisk")}
          </Badge>
        </Label>
        <Input value={profile.primary_category ?? "—"} disabled readOnly />
      </div>
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">
          {t("googleProfile.field.additional_categories")}
        </Label>
        {draft.additional_categories.map((cat, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              value={cat}
              disabled={disabled}
              onChange={(e) =>
                setDraft((d) => {
                  if (!d) return d;
                  const next = [...d.additional_categories];
                  next[index] = e.target.value;
                  return { ...d, additional_categories: next };
                })
              }
            />
            {!disabled && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("googleProfile.remove")}
                onClick={() =>
                  setDraft((d) =>
                    d
                      ? {
                          ...d,
                          additional_categories: d.additional_categories.filter(
                            (_, i) => i !== index,
                          ),
                        }
                      : d,
                  )
                }
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
        ))}
        {!disabled &&
          draft.additional_categories.length <
            GBP_MAX_ADDITIONAL_CATEGORIES && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setDraft((d) =>
                  d
                    ? {
                        ...d,
                        additional_categories: [...d.additional_categories, ""],
                      }
                    : d,
                )
              }
            >
              {t("googleProfile.addCategory")}
            </Button>
          )}
      </div>
    </SectionCard>
  );
}

function AddressCard({
  profile,
  onRequest,
  t,
}: {
  profile: OfficeGoogleProfileDetailRow;
  onRequest: () => void;
  t: TFunction<"dashboard">;
}) {
  const address = [
    profile.address_line_1,
    profile.address_line_2,
    [profile.postal_code, profile.city].filter(Boolean).join(" "),
    profile.region,
    profile.country,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <SectionCard
      icon={MapPin}
      title={t("googleProfile.sectionAddress")}
      action={
        <Button variant="outline" size="sm" onClick={onRequest}>
          {t("googleProfile.requestChange")}
        </Button>
      }
    >
      <p className="text-sm">{address || "—"}</p>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
          {t("googleProfile.highRisk")}
        </Badge>
        {profile.latitude != null && profile.longitude != null && (
          <span dir="ltr">
            {profile.latitude.toFixed(5)}, {profile.longitude.toFixed(5)}
          </span>
        )}
        {profile.google_place_id && (
          <span dir="ltr" className="truncate">
            {profile.google_place_id}
          </span>
        )}
      </div>
    </SectionCard>
  );
}

function HoursCard({
  draft,
  setDraft,
  disabled,
  t,
}: {
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft | null>>;
  disabled: boolean;
  t: TFunction<"dashboard">;
}) {
  const hours = draft.regular_hours ?? {};

  function setDay(
    day: GbpWeekday,
    periods: { open: string; close: string }[] | null,
  ) {
    setDraft((d) => {
      if (!d) return d;
      const next: GbpRegularHours = { ...(d.regular_hours ?? {}) };
      next[day] = periods;
      return { ...d, regular_hours: next };
    });
  }

  return (
    <SectionCard icon={Clock3} title={t("googleProfile.sectionHours")}>
      <div className="space-y-2">
        {GBP_WEEKDAYS.map((day) => {
          const periods = hours[day] ?? null;
          const open = Boolean(periods && periods.length);
          return (
            <div
              key={day}
              className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[110px_auto_1fr]"
            >
              <span className="text-sm font-medium">
                {t(`googleProfile.day.${day}`)}
              </span>
              <Switch
                checked={open}
                disabled={disabled}
                onCheckedChange={(checked) =>
                  setDay(
                    day,
                    checked ? [{ open: "09:00", close: "17:00" }] : null,
                  )
                }
              />
              {open && periods ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    dir="ltr"
                    className="w-[120px]"
                    value={periods[0].open}
                    disabled={disabled}
                    onChange={(e) =>
                      setDay(day, [{ ...periods[0], open: e.target.value }])
                    }
                  />
                  <span className="text-muted-foreground">–</span>
                  <Input
                    type="time"
                    dir="ltr"
                    className="w-[120px]"
                    value={periods[0].close}
                    disabled={disabled}
                    onChange={(e) =>
                      setDay(day, [{ ...periods[0], close: e.target.value }])
                    }
                  />
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">
                  {t("googleProfile.closed")}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

function RequestList({
  requests,
  isAdmin,
  busy,
  onDecide,
  t,
}: {
  requests: GoogleProfileChangeRequestRow[];
  isAdmin: boolean;
  busy: boolean;
  onDecide: (r: GoogleProfileChangeRequestRow) => void;
  t: TFunction<"dashboard">;
}) {
  if (!requests.length) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {t("googleProfile.noRequests")}
        </CardContent>
      </Card>
    );
  }
  const statusVariant: Record<
    string,
    "default" | "secondary" | "destructive" | "outline"
  > = {
    PENDING: "secondary",
    APPROVED: "default",
    REJECTED: "destructive",
    FAILED: "destructive",
    CANCELLED: "outline",
  };
  return (
    <div className="space-y-2">
      {requests.map((request) => (
        <Card key={request.id} className="rounded-xl">
          <CardContent className="flex flex-wrap items-start justify-between gap-3 py-3">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">
                  {t(
                    `googleProfile.requestField.${request.field}`,
                    request.field,
                  )}
                </span>
                <Badge variant={statusVariant[request.status] ?? "outline"}>
                  {t(`googleProfile.status.${request.status}`, request.status)}
                </Badge>
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {formatValue(request.requested_value)}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("googleProfile.requestedBy", {
                  name: request.requested_by_name || "—",
                })}
                {request.reason ? ` · ${request.reason}` : ""}
              </p>
              {request.apply_error_message && (
                <p className="text-xs text-destructive">
                  {request.apply_error_message}
                </p>
              )}
            </div>
            {isAdmin && request.status === "PENDING" && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => onDecide(request)}
              >
                {t("googleProfile.review")}
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((i) => (
        <Card key={i} className="rounded-2xl">
          <CardContent className="space-y-3 py-5">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
