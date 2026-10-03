import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CalendarDays,
  ExternalLink,
  Link2,
  MapPin,
  Star,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useOfficeWorkspaceContext } from "@/components/office/OfficeWorkspaceLayout";
import {
  officeAppointmentsPath,
  officeGooglePath,
  officeWorkspacePath,
  type OfficeSurface,
} from "@/lib/officeWorkspace";
import { Link } from "@/lib/router-compat";

type TodayAppointment = {
  id: string;
  scheduled_at: string;
  status: string | null;
  case: { full_name: string | null } | null;
};

function timeLabel(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/**
 * Office Overview — the command center for one office. It shows today's
 * appointments, the Google Business summary, the public booking entry points,
 * and the team, all under one office context.
 */
export default function OfficeOverviewPage({
  surface,
}: {
  surface: OfficeSurface;
}) {
  const { t } = useTranslation("dashboard");
  // The layout resolved the slug to a uuid and authorized the caller; reuse it
  // rather than re-querying the same workspace context.
  const workspace = useOfficeWorkspaceContext();
  const officeId = workspace?.officeId;
  const [todayAppointments, setTodayAppointments] = useState<
    TodayAppointment[]
  >([]);
  const [todayError, setTodayError] = useState(false);

  const loadToday = useCallback(async () => {
    if (!officeId) return;
    setTodayError(false);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const { data, error } = await supabase
      .from("appointments")
      .select("id, scheduled_at, status, case:cases(full_name)")
      .eq("office_id", officeId)
      .gte("scheduled_at", start.toISOString())
      .lt("scheduled_at", end.toISOString())
      .order("scheduled_at");
    // A failed read must not render as "no appointments today".
    if (error) {
      setTodayError(true);
      setTodayAppointments([]);
    } else {
      setTodayAppointments((data as unknown as TodayAppointment[]) ?? []);
    }
  }, [officeId]);

  useEffect(() => {
    loadToday();
  }, [loadToday]);

  const context = workspace?.context;
  const office = context?.office;
  const google = context?.google;
  const bookingUrl = useMemo(
    () =>
      office?.slug
        ? `/book-appointment?office=${encodeURIComponent(office.slug)}`
        : null,
    [office?.slug],
  );
  const applyUrl = useMemo(
    () =>
      office?.slug ? `/apply?office=${encodeURIComponent(office.slug)}` : null,
    [office?.slug],
  );
  const mapsUrl = google?.google_maps_url || office?.map_url || null;

  if (!office) return null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="rounded-2xl border-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="size-4 text-primary" />
            {t("officeWorkspace.today", "Today")}
          </CardTitle>
          <Link
            to={officeAppointmentsPath(surface, office.slug)}
            className="text-sm font-medium text-primary hover:underline"
          >
            {t("officeWorkspace.viewCalendar", "View calendar")}
          </Link>
        </CardHeader>
        <CardContent className="space-y-2">
          {todayError ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {t("common.error", "Something went wrong. Please try again.")}
            </p>
          ) : todayAppointments.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {t(
                "officeWorkspace.noAppointmentsToday",
                "No appointments today.",
              )}
            </p>
          ) : (
            todayAppointments.map((appt) => (
              <div
                key={appt.id}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {appt.case?.full_name ??
                      t("officeWorkspace.unknownClient", "Client")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {timeLabel(appt.scheduled_at)}
                  </p>
                </div>
                {appt.status ? (
                  <Badge variant="outline">{appt.status}</Badge>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Star className="size-4 text-amber-400" />
            {t("officeWorkspace.googleBusiness", "Google Business")}
          </CardTitle>
          <Link
            to={officeGooglePath(surface, office.slug)}
            className="text-sm font-medium text-primary hover:underline"
          >
            {t("officeWorkspace.open", "Open")}
          </Link>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {google?.connected ? (
            <>
              {google.google_location_name ? (
                <p className="font-medium">{google.google_location_name}</p>
              ) : null}
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="inline-block size-2 rounded-full bg-emerald-500" />
                {t("officeWorkspace.googleHealthy", "Connected")}
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">
              {t("officeWorkspace.googleOffline", "Not connected")}
            </p>
          )}
          {mapsUrl ? (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <MapPin className="size-4" />
              {t("officeWorkspace.openMaps", "Google Maps")}
              <ExternalLink className="size-3.5" />
            </a>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border shadow-sm">
        <CardHeader className="space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="size-4 text-primary" />
            {t("officeWorkspace.publicBooking", "Public booking")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Badge variant={office.booking_enabled ? "secondary" : "outline"}>
            {office.booking_enabled
              ? t("officeWorkspace.bookingEnabled", "Booking enabled")
              : t("officeWorkspace.bookingDisabled", "Booking disabled")}
          </Badge>
          {bookingUrl ? (
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-primary hover:underline"
            >
              {bookingUrl}
            </a>
          ) : null}
          {applyUrl ? (
            <div className="text-muted-foreground">
              {t("officeWorkspace.applyLink", "Apply")}:{" "}
              <a
                href={applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {applyUrl}
              </a>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4 text-primary" />
            {t("officeWorkspace.team", "Team")}
          </CardTitle>
          <Link
            to={`${officeWorkspacePath(surface, office.slug)}/team`}
            className="text-sm font-medium text-primary hover:underline"
          >
            {t("officeWorkspace.manageTeam", "Manage team")}
          </Link>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {context?.team.primary_name ? (
            <p>
              <span className="text-muted-foreground">
                {t("officeWorkspace.primary", "Primary")}:
              </span>{" "}
              {context.team.primary_name}
            </p>
          ) : null}
          {context?.team.side_name ? (
            <p>
              <span className="text-muted-foreground">
                {t("officeWorkspace.sideManager", "Side Manager")}:
              </span>{" "}
              {context.team.side_name}
            </p>
          ) : null}
          <p className="text-muted-foreground">
            {t("officeWorkspace.members", "Team")}:{" "}
            {context?.membership.member_count ?? 0}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
