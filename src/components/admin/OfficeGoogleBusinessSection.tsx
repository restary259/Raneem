import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Clock3,
  Link2,
  ShieldCheck,
  Trash2,
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
  adminAssignGooglePrimary,
  assignGoogleSideManager,
  getGoogleBusinessActivity,
  listOfficeGoogleProfiles,
  removeGoogleOperator,
} from "@/lib/googleBusinessApi";
import { canGoogleOfficeAction } from "@/lib/googlePermissions";
import type {
  GoogleBusinessActivityRow,
  GoogleConnectionStatus,
  GoogleOperatorRole,
  OfficeGoogleProfileRow,
} from "@/types/googleBusiness";

type TeamMemberOption = { id: string; full_name: string };

type Props = {
  officeId: string;
  /** Active team members who belong to THIS office only. */
  eligibleMembers: TeamMemberOption[];
  isAdmin: boolean;
  /** The caller's operator role for this office, if any. */
  operatorRole?: GoogleOperatorRole | null;
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

function isSameOffice(profile: OfficeGoogleProfileRow, officeId: string) {
  return profile.office_id === officeId;
}

/**
 * Phase 1 admin surface: office -> Google profile placeholder -> PRIMARY /
 * SIDE_MANAGER operators -> audit feed. It performs no Google API calls; the
 * Connect control is intentionally disabled until Phase 2 ships OAuth.
 */
export default function OfficeGoogleBusinessSection({
  officeId,
  eligibleMembers,
  isAdmin,
  operatorRole = null,
  onChanged,
}: Props) {
  const { t, i18n } = useTranslation("dashboard");
  const { toast } = useToast();
  const [profile, setProfile] = useState<OfficeGoogleProfileRow | null>(null);
  const [activity, setActivity] = useState<GoogleBusinessActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [primaryChoice, setPrimaryChoice] = useState("");
  const [sideChoice, setSideChoice] = useState("");

  const canAssignSide = useMemo(
    () =>
      canGoogleOfficeAction(
        { isAdmin, isOfficeMember: true, operatorRole },
        "GOOGLE_ASSIGN_SIDE_MANAGER",
      ),
    [isAdmin, operatorRole],
  );

  const load = useCallback(
    async function () {
      setLoading(true);
      try {
        const [profileRes, activityRes] = await Promise.all([
          listOfficeGoogleProfiles(),
          getGoogleBusinessActivity(officeId, 10),
        ]);
        if (profileRes.error) throw profileRes.error;
        if (activityRes.error) throw activityRes.error;
        const rows = (profileRes.data || []).filter((row) =>
          isSameOffice(row, officeId),
        );
        setProfile(rows.length ? rows[0] : null);
        setActivity(activityRes.data || []);
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
    [officeId, t, toast],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPrimaryChoice(profile?.primary_operator_id || "");
    setSideChoice("");
  }, [profile?.primary_operator_id]);

  const primaryName = profile?.primary_operator_name || null;
  const sideName = profile?.side_manager_name || null;
  const status: GoogleConnectionStatus =
    profile?.connection_status || "not_connected";

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

  const sideChoices = eligibleMembers.filter(
    (member) => member.id !== profile?.primary_operator_id,
  );

  return (
    <Card className="rounded-2xl border-border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Link2 className="size-4 text-primary" />
            {t("admin.googleBusiness.title")}
          </CardTitle>
          <Badge variant={STATUS_VARIANT[status]}>
            {t(`admin.googleBusiness.status.${status}`)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <p className="text-sm text-muted-foreground">
            {t("admin.googleBusiness.loading")}
          </p>
        ) : (
          <>
            <section className="space-y-2 rounded-xl border border-border p-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="size-4 text-primary" />
                {t("admin.googleBusiness.profile")}
              </div>
              {profile && profile.google_location_id ? (
                <p className="break-all text-sm text-muted-foreground">
                  {profile.google_location_id}
                </p>
              ) : (
                <>
                  <p className="text-sm font-medium">
                    {t("admin.googleBusiness.notConnectedTitle")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("admin.googleBusiness.notConnectedDesc")}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled
                    title={t("admin.googleBusiness.comingSoon")}
                  >
                    <Link2 className="me-2 size-4" />
                    {t("admin.googleBusiness.connect")}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    {t("admin.googleBusiness.comingSoon")}
                  </p>
                </>
              )}
            </section>

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
                          {eligibleMembers.map((member) => (
                            <SelectItem key={member.id} value={member.id}>
                              {member.full_name}
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
                            <SelectItem key={member.id} value={member.id}>
                              {member.full_name}
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
    </Card>
  );
}
