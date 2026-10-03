import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "@/lib/router-compat";
import { Home, LogOut, MessageSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import LanguageSwitcher from "@/components/common/LanguageSwitcher";
import ThemePicker from "@/components/common/ThemePicker";
import NotificationBell from "@/components/common/NotificationBell";
import { SidebarTrigger } from "@/components/ui/sidebar";
import type { AppRole } from "@/contexts/AuthContext";
import { useGoogleBusinessAccess } from "@/hooks/useGoogleBusinessAccess";
import {
  findDashboardNavItem,
  getDashboardNav,
  matchesDashboardNavPath,
} from "@/components/layout/dashboardNavigation";

interface UserLike {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}

interface DashboardHeaderProps {
  role: AppRole;
  user: UserLike | null;
  onSignOut: () => Promise<void>;
}

function getDisplayName(user: UserLike | null, fallback: string) {
  const metadata = user?.user_metadata;
  return (
    (typeof metadata?.full_name === "string" && metadata.full_name.trim()) ||
    (typeof metadata?.name === "string" && metadata.name.trim()) ||
    user?.email?.split("@")[0] ||
    fallback
  );
}

function getInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "D"
  );
}

function QuickActions({ role }: { role: AppRole }) {
  const { t } = useTranslation("dashboard");
  const actions = getDashboardNav(role).quickActions ?? [];

  if (actions.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="icon"
          className="h-10 w-10 rounded-full shadow-sm sm:h-11 sm:w-11"
          aria-label={t("nav.quickActions")}
          title={t("nav.quickActions")}
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-72 max-w-[calc(100vw-1rem)] p-2"
      >
        <DropdownMenuLabel className="px-2 pb-2 pt-1 text-xs text-muted-foreground">
          {t("nav.quickActions")}
        </DropdownMenuLabel>
        <div className="grid grid-cols-2 gap-1">
          {actions.map(({ key, icon: Icon, href }) => (
            <DropdownMenuItem key={href} asChild className="h-auto cursor-pointer rounded-lg p-2.5">
              <Link to={href} className="flex min-w-0 items-center gap-2.5">
                <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="min-w-0 truncate">{t(key)}</span>
              </Link>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AccountMenu({ role, user, onSignOut }: DashboardHeaderProps) {
  const { t, i18n } = useTranslation("dashboard");
  const navigate = useNavigate();
  const config = getDashboardNav(role);
  const displayName = getDisplayName(user, t("nav.student"));
  const initials = getInitials(displayName);
  const isRtl = i18n.language.startsWith("ar") || i18n.language.startsWith("he");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-10 w-10 rounded-full p-0 sm:h-11 sm:w-11"
          aria-label={t("nav.accountMenu")}
          title={t("nav.accountMenu")}
        >
          <Avatar className="h-9 w-9 border border-border sm:h-10 sm:w-10">
            <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={isRtl ? "start" : "end"}
        sideOffset={8}
        className="w-72 max-w-[calc(100vw-1rem)] p-2"
      >
        <DropdownMenuLabel className="px-2 py-2">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="h-10 w-10 shrink-0 border border-border">
              <AvatarFallback className="bg-primary/10 font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
              {user?.email && (
                <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>
              )}
            </div>
          </div>
        </DropdownMenuLabel>

        {config.accountItems.length > 0 && (
          <>
            <DropdownMenuSeparator />
            {config.accountItems.map(({ key, icon: Icon, href }) => (
              <DropdownMenuItem key={href} asChild className="cursor-pointer rounded-lg py-2.5">
                <Link to={href} className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>{t(key)}</span>
                </Link>
              </DropdownMenuItem>
            ))}
          </>
        )}

        <DropdownMenuSeparator />
        <div className="rounded-lg border border-border/70 p-2">
          <p className="px-1 pb-2 text-xs font-medium text-muted-foreground">
            {t("nav.language")}
          </p>
          <LanguageSwitcher className="w-full justify-center gap-2" />
        </div>

        <div className="mt-2 flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
          <span className="text-xs font-medium text-muted-foreground">{t("theme.choose")}</span>
          <ThemePicker />
        </div>

        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer rounded-lg py-2.5">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex w-full items-center gap-2.5"
          >
            <Home className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span>{t("nav.mainSite")}</span>
          </button>
        </DropdownMenuItem>

        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            void onSignOut();
          }}
          className="cursor-pointer rounded-lg py-2.5 text-destructive focus:text-destructive"
        >
          <LogOut className="me-2 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{t("header.signOut")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function DashboardHeader({ role, user, onSignOut }: DashboardHeaderProps) {
  const { t } = useTranslation("dashboard");
  const location = useLocation();
  const navigate = useNavigate();
  const config = getDashboardNav(role);
  const googleBusinessAccess = useGoogleBusinessAccess(role === "team_member");
  const currentItem = useMemo(() => {
    const item = findDashboardNavItem(role, location.pathname);
    // A team member without an office assignment must not see the Google
    // Business or Offices page title (or a stale tab title) in the header —
    // both nav entries are hidden for them by `resolveDashboardNavItems`.
    const gatedHrefs = ["/team/google", "/team/offices"];
    if (
      role === "team_member" &&
      !googleBusinessAccess &&
      item &&
      gatedHrefs.some(
        (prefix) => item.href === prefix || item.href.startsWith(`${prefix}/`),
      )
    ) {
      return undefined;
    }
    return item;
  }, [role, location.pathname, googleBusinessAccess]);

  const pageTitleKey = currentItem?.key ?? config.homeTitleKey;
  const messageItem = config.messagesHref
    ? { key: "nav.messages", href: config.messagesHref, icon: MessageSquare }
    : null;
  const isMessageActive = messageItem
    ? matchesDashboardNavPath(location.pathname, messageItem)
    : false;

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border/50 bg-background/95 px-2 backdrop-blur z-10 sm:px-4">
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger className="h-11 w-11 shrink-0" />
        <div className="hidden min-w-0 sm:block">
          <p className="truncate text-sm font-semibold text-foreground">{t(pageTitleKey)}</p>
        </div>
      </div>

      <div className="flex min-w-0 shrink-0 items-center gap-1 sm:gap-2">
        <QuickActions role={role} />

        <div className="hidden items-center gap-1 sm:gap-2 md:flex">
          <LanguageSwitcher />
          <ThemePicker />
          {config.messagesHref && (
            <Button
              variant={isMessageActive ? "secondary" : "ghost"}
              size="sm"
              onClick={() => navigate(config.messagesHref!)}
              aria-label={t("nav.messages")}
              title={t("nav.messages")}
              className="relative h-11 w-11 shrink-0 p-0 text-muted-foreground hover:text-foreground sm:w-auto sm:gap-2 sm:p-2"
            >
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              <span className="hidden text-xs sm:inline">{t("nav.messages")}</span>
            </Button>
          )}
        </div>

        {user && <NotificationBell role={role} />}
        <AccountMenu role={role} user={user} onSignOut={onSignOut} />
      </div>
    </header>
  );
}
