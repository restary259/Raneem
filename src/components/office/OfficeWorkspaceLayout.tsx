import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import {
  Building2,
  CalendarDays,
  Clock3,
  ExternalLink,
  LayoutDashboard,
  MapPin,
  ShieldAlert,
  Star,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { GoogleOfficeSubnav } from "@/components/google/GoogleOfficeSubnav";
import { useGoogleBusinessAccess } from "@/hooks/useGoogleBusinessAccess";
import {
  getOfficeWorkspace,
  resolveOfficeSlug,
  type OfficeWorkspaceContext,
} from "@/lib/officeApi";
import {
  officeAppointmentsPath,
  officeGooglePath,
  officeWorkspacePath,
  type GoogleTab,
  type OfficeSurface,
} from "@/lib/officeWorkspace";
import { Link } from "@/lib/router-compat";
import { cn } from "@/lib/utils";

type Props = {
  surface: OfficeSurface;
  /** The route param, which carries the office *slug* (not a uuid). */
  officeId: string | undefined;
  children: ReactNode;
  /** When set, the Google Business section is active and its sub-tabs show. */
  googleTab?: GoogleTab;
};

type WorkspaceValue = {
  /** Resolved office uuid — never the slug, so children can query by id. */
  officeId: string;
  slug: string;
  context: OfficeWorkspaceContext;
};

const OfficeWorkspaceContextValue = createContext<WorkspaceValue | null>(null);

/**
 * The resolved office context for children of {@link OfficeWorkspaceLayout}.
 * Returns `null` when rendered outside an office workspace (e.g. the
 * cross-office `/team/appointments` page), which callers treat as "no office
 * scope" rather than inventing one.
 */
export function useOfficeWorkspaceContext(): WorkspaceValue | null {
  return useContext(OfficeWorkspaceContextValue);
}

/**
 * The canonical office workspace chrome.
 *
 * Every office route resolves the same server-side context
 * (`get_office_workspace`, which authorizes admin-or-member) and renders one
 * header: identity, status, team, and Google health. This is what makes an
 * office — not Google Business — the navigation context.
 */
export function OfficeWorkspaceLayout({
  surface,
  officeId,
  children,
  googleTab,
}: Props) {
  const { t } = useTranslation("dashboard");
  const [context, setContext] = useState<OfficeWorkspaceContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Google Business is only a tab for a team member assigned as an office
  // operator. The admin surface keeps it unconditionally; team members wait for
  // the server flag (`false` while unresolved) so it is hidden by default.
  const hasGoogleBusiness = useGoogleBusinessAccess(surface === "team");
  const showGoogle = surface === "admin" || hasGoogleBusiness === true;

  const load = useCallback(async () => {
    if (!officeId) {
      setLoading(false);
      setError("notFound");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // The route param is the public slug; every RPC below needs the uuid.
      const resolved = await resolveOfficeSlug(officeId);
      if (resolved.error) throw resolved.error;
      if (!resolved.data) throw new Error("notFound");
      const { data, error: rpcError } = await getOfficeWorkspace(resolved.data);
      if (rpcError) throw rpcError;
      if (!data) throw new Error("notFound");
      setContext(data);
    } catch (err) {
      const message = String((err as { message?: string })?.message ?? "");
      setError(/Forbidden/i.test(message) ? "forbidden" : "notFound");
    } finally {
      setLoading(false);
    }
  }, [officeId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 pt-6 sm:px-6">
        <Card className="rounded-2xl border-border shadow-sm">
          <CardContent className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Clock3 className="size-4 animate-spin" />
            {t("officeWorkspace.loading", "Loading office…")}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !context) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 pt-6 sm:px-6">
        <Card className="rounded-2xl border-border shadow-sm">
          <CardContent className="space-y-3 py-10 text-center">
            <ShieldAlert className="mx-auto size-8 text-muted-foreground" />
            <p className="text-sm font-medium">
              {error === "forbidden"
                ? t(
                    "officeWorkspace.forbidden",
                    "You do not have access to this office",
                  )
                : t("officeWorkspace.notFound", "Office not found")}
            </p>
            <Link
              to={surface === "admin" ? "/admin/offices" : "/team/offices"}
              className="inline-block text-sm font-medium text-primary hover:underline"
            >
              {t("officeWorkspace.backToOffices", "Back to offices")}
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { office, team, google, membership } = context;
  const slug = office.slug;
  const googleConnected =
    google.connected &&
    google.mapping_status !== "MAPPING_ERROR" &&
    google.connection_status !== "error";
  const mapsUrl = google.google_maps_url || office.map_url;

  const sections: {
    key: string;
    to: string;
    icon: ReactNode;
    label: string;
    active: boolean;
  }[] = [
    {
      key: "overview",
      to: officeWorkspacePath(surface, slug),
      icon: <LayoutDashboard className="size-4" />,
      label: t("officeWorkspace.overview", "Overview"),
      active: googleTab === undefined,
    },
    {
      key: "appointments",
      to: officeAppointmentsPath(surface, slug),
      icon: <CalendarDays className="size-4" />,
      label: t("officeWorkspace.appointments", "Appointments"),
      active: false,
    },
    {
      key: "team",
      to: `${officeWorkspacePath(surface, slug)}/team`,
      icon: <Users className="size-4" />,
      label: t("officeWorkspace.team", "Team"),
      active: false,
    },
    ...(showGoogle
      ? [
          {
            key: "google",
            to: officeGooglePath(surface, slug),
            icon: <Star className="size-4" />,
            label: t("officeWorkspace.googleBusiness", "Google Business"),
            active: googleTab !== undefined,
          },
        ]
      : []),
  ];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 pt-4 sm:px-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="flex items-center gap-2 text-2xl font-semibold">
              <Building2 className="size-5 text-primary" />
              {office.name}
            </h1>
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" />
                {office.city}
                {office.country ? `, ${office.country}` : ""}
              </span>
              <Badge
                variant={office.is_active ? "secondary" : "outline"}
                className="gap-1"
              >
                {office.is_active
                  ? t("officeWorkspace.active", "Active")
                  : t("officeWorkspace.inactive", "Inactive")}
              </Badge>
              <Badge
                variant={office.booking_enabled ? "secondary" : "outline"}
                className="gap-1"
              >
                {office.booking_enabled
                  ? t("officeWorkspace.bookingEnabled", "Booking enabled")
                  : t("officeWorkspace.bookingDisabled", "Booking disabled")}
              </Badge>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {mapsUrl ? (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm hover:bg-muted"
              >
                <MapPin className="size-4" />
                {t("officeWorkspace.openMaps", "Google Maps")}
                <ExternalLink className="size-3.5" />
              </a>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          {team.primary_name ? (
            <span className="text-muted-foreground">
              {t("officeWorkspace.primary", "Primary")}:{" "}
              <span className="font-medium text-foreground">
                {team.primary_name}
              </span>
            </span>
          ) : null}
          {team.side_name ? (
            <span className="text-muted-foreground">
              {t("officeWorkspace.sideManager", "Side Manager")}:{" "}
              <span className="font-medium text-foreground">
                {team.side_name}
              </span>
            </span>
          ) : null}
          <span className="text-muted-foreground">
            {t("officeWorkspace.members", "Team")}:{" "}
            <span className="font-medium text-foreground">
              {membership.member_count}
            </span>
          </span>
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <span
              className={cn(
                "inline-block size-2 rounded-full",
                googleConnected ? "bg-emerald-500" : "bg-muted-foreground",
              )}
            />
            Google{" "}
            {googleConnected
              ? t("officeWorkspace.googleHealthy", "Connected")
              : t("officeWorkspace.googleOffline", "Not connected")}
          </span>
        </div>
      </header>

      <nav className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        {sections.map((section) => (
          <Link
            key={section.key}
            to={section.to}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors",
              section.active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {section.icon}
            {section.label}
          </Link>
        ))}
      </nav>

      {googleTab !== undefined ? (
        <GoogleOfficeSubnav
          surface={surface}
          slug={slug}
          officeName={office.name}
          active={googleTab}
        />
      ) : null}

      <OfficeWorkspaceContextValue.Provider
        value={{ officeId: office.id, slug, context }}
      >
        {children}
      </OfficeWorkspaceContextValue.Provider>
    </div>
  );
}
