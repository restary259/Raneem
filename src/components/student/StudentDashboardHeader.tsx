import { useTranslation } from "react-i18next";
import { Link, useLocation } from "@/lib/router-compat";
import {
  FileText,
  Heart,
  ListChecks,
  MapPinned,
  MessageSquare,
  Plus,
  Receipt,
  User,
  Users,
  Calculator,
  Home,
  ShieldCheck,
  LogOut,
} from "lucide-react";
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

interface UserLike {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}

interface StudentDashboardHeaderProps {
  user: UserLike | null;
  onSignOut: () => Promise<void>;
}

const QUICK_ACTIONS = [
  { key: "nav.checklist", icon: ListChecks, href: "/student/checklist" },
  { key: "nav.documents", icon: FileText, href: "/student/documents" },
  { key: "nav.visa", icon: Globe, href: "/student/visa" },
  { key: "nav.fees", icon: Receipt, href: "/student/fees" },
  { key: "nav.messages", icon: MessageSquare, href: "/student/messages" },
  { key: "nav.cityGuide", icon: MapPinned, href: "/student/city-guide" },
  { key: "nav.contacts", icon: Users, href: "/student/contacts" },
  { key: "nav.myData", icon: ShieldCheck, href: "/student/my-data" },
  { key: "nav.bagrut", icon: Calculator, href: "/student/tools/bagrut" },
  { key: "nav.cvBuilder", icon: FileText, href: "/student/tools/cv" },
  { key: "nav.refer", icon: Heart, href: "/student/refer" },
] as const;

function getDisplayName(user: UserLike | null, fallback: string) {
  const metadata = user?.user_metadata;
  const candidate =
    (typeof metadata?.full_name === "string" && metadata.full_name.trim()) ||
    (typeof metadata?.name === "string" && metadata.name.trim()) ||
    user?.email?.split("@")[0] ||
    fallback;
  return candidate;
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "D";
}

function StudentQuickActions() {
  const { t } = useTranslation("dashboard");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="icon"
          className="h-10 w-10 rounded-full shadow-sm sm:h-11 sm:w-11"
          aria-label={t("nav.quickActions", "Quick actions")}
          title={t("nav.quickActions", "Quick actions")}
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-72 max-w-[calc(100vw-1rem)] p-2">
        <DropdownMenuLabel className="px-2 pb-2 pt-1 text-xs text-muted-foreground">
          {t("nav.quickActions", "Quick actions")}
        </DropdownMenuLabel>
        <div className="grid grid-cols-2 gap-1">
          {QUICK_ACTIONS.map(({ key, icon: Icon, href }) => (
            <DropdownMenuItem key={href} asChild className="h-auto cursor-pointer rounded-lg p-2.5">
              <Link to={href} className="flex min-w-0 items-center gap-2.5">
                <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="min-w-0 truncate">{t(key, key)}</span>
              </Link>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StudentAccountMenu({ user, onSignOut }: StudentDashboardHeaderProps) {
  const { t } = useTranslation("dashboard");
  const displayName = getDisplayName(user, t("nav.student", "Student"));
  const initials = getInitials(displayName);

  const handleSignOut = async () => {
    await onSignOut();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-10 w-10 rounded-full p-0 sm:h-11 sm:w-11"
          aria-label={t("nav.accountMenu", "Account menu")}
          title={t("nav.accountMenu", "Account menu")}
        >
          <Avatar className="h-9 w-9 border border-border sm:h-10 sm:w-10">
            <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
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
              <p className="mt-0.5 text-xs font-normal text-muted-foreground">
                {t("nav.student", "Student")}
              </p>
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild className="cursor-pointer rounded-lg py-2.5">
          <Link to="/student/profile" className="flex items-center gap-2.5">
            <User className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span>{t("nav.profile", "Profile")}</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className="cursor-pointer rounded-lg py-2.5">
          <Link to="/student/my-data" className="flex items-center gap-2.5">
            <ShieldCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span>{t("nav.myData", "My data")}</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className="cursor-pointer rounded-lg py-2.5">
          <Link to="/" className="flex items-center gap-2.5">
            <Home className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span>{t("nav.mainSite", "Main website")}</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <div className="rounded-lg border border-border/70 p-2">
          <p className="px-1 pb-2 text-xs font-medium text-muted-foreground">
            {t("nav.language", "Language")}
          </p>
          <LanguageSwitcher className="w-full justify-center gap-2 sm:gap-2" />
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            void handleSignOut();
          }}
          className="cursor-pointer rounded-lg py-2.5 text-destructive focus:text-destructive"
        >
          <LogOut className="me-2 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{t("header.signOut", "Sign out")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function StudentDashboardHeader({
  user,
  onSignOut,
}: StudentDashboardHeaderProps) {
  const { t } = useTranslation("dashboard");
  const location = useLocation();
  const pageTitleKey =
    location.pathname === "/student"
      ? "nav.home"
      : ([
          ["/student/city-guide", "nav.cityGuide"],
          ["/student/checklist", "nav.checklist"],
          ["/student/documents", "nav.documents"],
          ["/student/visa", "nav.visa"],
          ["/student/fees", "nav.fees"],
          ["/student/messages", "nav.messages"],
          ["/student/contacts", "nav.contacts"],
          ["/student/profile", "nav.profile"],
          ["/student/my-data", "nav.myData"],
          ["/student/tools/bagrut", "nav.bagrut"],
          ["/student/tools/cv", "nav.cvBuilder"],
          ["/student/refer", "nav.refer"],
        ] as const).find(([path]) => location.pathname.startsWith(path))?.[1] ?? "nav.home";
  const pageTitle = t(pageTitleKey, "Home");

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border/50 bg-background/95 px-2 backdrop-blur sm:px-4">
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger className="h-11 w-11 shrink-0" />
        <div className="hidden min-w-0 sm:block">
          <p className="truncate text-sm font-semibold text-foreground">
            {pageTitle}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <StudentQuickActions />
        {user && <NotificationBell role="student" />}
        <ThemePicker />
        {user && <StudentAccountMenu user={user} onSignOut={onSignOut} />}
      </div>
    </header>
  );
}
