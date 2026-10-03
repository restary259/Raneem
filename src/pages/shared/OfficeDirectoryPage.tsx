import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Building2, Clock3, MapPin, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { listMyOffices, type MyOfficeRow } from "@/lib/officeApi";
import { officeWorkspacePath, type OfficeSurface } from "@/lib/officeWorkspace";
import { Link } from "@/lib/router-compat";

/**
 * The office directory — the entry point to every office workspace. Opening an
 * office is the primary navigation gesture; Google Business, appointments, and
 * team all live *inside* that office.
 */
export default function OfficeDirectoryPage({
  surface = "team",
}: {
  surface?: OfficeSurface;
}) {
  const { t } = useTranslation("dashboard");
  const [offices, setOffices] = useState<MyOfficeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const { data, error: rpcError } = await listMyOffices();
      // A failed read must stay distinguishable from an empty office list.
      if (rpcError) throw rpcError;
      setOffices(data ?? []);
    } catch {
      setError(true);
      setOffices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 pt-4 sm:px-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Building2 className="size-5 text-primary" />
          {t("officeWorkspace.directoryTitle", "Offices")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t(
            "officeWorkspace.directorySubtitle",
            "Open an office to manage its appointments, team, and Google Business.",
          )}
        </p>
      </header>

      {loading ? (
        <Card className="rounded-2xl border-border shadow-sm">
          <CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Clock3 className="size-4 animate-spin" />
            {t("officeWorkspace.loading", "Loading office…")}
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="rounded-2xl border-border shadow-sm">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t("common.error", "Something went wrong. Please try again.")}
          </CardContent>
        </Card>
      ) : offices.length === 0 ? (
        <Card className="rounded-2xl border-border shadow-sm">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t("officeWorkspace.directoryEmpty", "No offices available yet.")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {offices.map((office) => (
            <Link
              key={office.office_id}
              to={officeWorkspacePath(surface, office.slug)}
              className="block rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/50"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-base font-semibold">
                    {office.name}
                  </p>
                  <p className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="size-3.5 shrink-0" />
                    {office.city}
                    {office.country ? `, ${office.country}` : ""}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0 gap-1">
                  <Star className="size-3.5" />
                  {office.google_connected
                    ? t("officeWorkspace.googleHealthy", "Connected")
                    : t("officeWorkspace.googleOffline", "Not connected")}
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant={office.is_active ? "secondary" : "outline"}>
                  {office.is_active
                    ? t("officeWorkspace.active", "Active")
                    : t("officeWorkspace.inactive", "Inactive")}
                </Badge>
                <Badge
                  variant={office.booking_enabled ? "secondary" : "outline"}
                >
                  {office.booking_enabled
                    ? t("officeWorkspace.bookingEnabled", "Booking enabled")
                    : t("officeWorkspace.bookingDisabled", "Booking disabled")}
                </Badge>
                <span>
                  {t("officeWorkspace.members", "Team")}: {office.member_count}
                </span>
                {office.primary_name ? (
                  <span>· {office.primary_name}</span>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
