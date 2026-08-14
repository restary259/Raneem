import React, { useEffect, useState } from "react";

import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import NotificationBell from "@/components/common/NotificationBell";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import NotificationOnboardingDialog from "@/components/notifications/NotificationOnboardingDialog";
import TabErrorBoundary from "@/components/common/TabErrorBoundary";
import LanguageSwitcher from "@/components/common/LanguageSwitcher";
import ThemeToggle from "@/components/common/ThemeToggle";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import { useUnreadCaseMessages } from "@/hooks/useUnreadCaseMessages";
import { useIsMasterPartner } from "@/hooks/useIsMasterPartner";
import { useIsManager } from "@/hooks/useIsManager";

import {
  LayoutDashboard,
  GitBranch,
  Users,
  BookOpen,
  FileCheck,
  DollarSign,
  BarChart2,
  Activity,
  Inbox,
  MessageSquare,

  Settings,
  CalendarDays,
  ClipboardList,
  UserPlus,
  GraduationCap,
  Link2,
  TrendingUp,
  ListChecks,
  User,
  FileText,
  Globe,
  Heart,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Home,
  Table,
  Calculator,
  Sparkles,
  Crown,
  ShieldCheck,
  Receipt,
  Wrench,
  ClipboardEdit,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChatFullscreenActive } from "@/components/messages/chatFullscreen";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface NavItem {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  /** i18n key of the sidebar group heading this item belongs to */
  group?: string;
  /** When present, this item renders as an expandable parent whose children
   *  live under it (collapsible). `href` is ignored for parents. */
  children?: NavItem[];
}

/**
 * Shared partner/ambassador sidebar items. Both roles share the base nav so the
 * two dashboards stay in sync; `social_media_partner` (lawyers) appends the
 * in-dashboard "Apply" item, while `ambassador` (influencers) keeps the
 * referral-link-only feature set. Declared as a const so the per-role arrays
 * can still diverge without duplicating the common entries.
 */
const PARTNER_BASE_NAV: NavItem[] = [
  { key: "nav.overview", icon: LayoutDashboard, href: "/partner" },
  { key: "nav.messages", icon: MessageSquare, href: "/partner/messages" },
  { key: "nav.students", icon: GraduationCap, href: "/partner/students" },
  { key: "nav.earnings", icon: TrendingUp, href: "/partner/earnings" },
  { key: "nav.account", icon: User, href: "/partner/profile" },
];

const NAV_CONFIG: Record<AppRole, NavItem[]> = {
  admin: [
    { key: "nav.messages", icon: MessageSquare, href: "/admin/messages", group: "nav.group.comms" },

    { key: "nav.overview", icon: LayoutDashboard, href: "/admin", group: "nav.group.work" },
    { key: "nav.pipeline", icon: GitBranch, href: "/admin/pipeline", group: "nav.group.work" },
    { key: "nav.submissions", icon: FileCheck, href: "/admin/submissions", group: "nav.group.work" },
    { key: "nav.inbox", icon: Inbox, href: "/admin/inbox", group: "nav.group.work" },

    { key: "nav.financials", icon: DollarSign, href: "/admin/financials", group: "nav.group.money" },
    { key: "nav.spreadsheet", icon: Table, href: "/admin/spreadsheet", group: "nav.group.money" },
    { key: "nav.analytics", icon: BarChart2, href: "/admin/analytics", group: "nav.group.money" },
    { key: "nav.team", icon: Users, href: "/admin/team", group: "nav.group.people" },
    { key: "nav.students", icon: GraduationCap, href: "/admin/students", group: "nav.group.people" },
    { key: "nav.referrals", icon: Link2, href: "/admin/referrals", group: "nav.group.people" },
    { key: "nav.programs", icon: BookOpen, href: "/admin/programs", group: "nav.group.setup" },
    { key: "nav.activity", icon: Activity, href: "/admin/activity", group: "nav.group.setup" },
    { key: "nav.settings", icon: Settings, href: "/admin/settings", group: "nav.group.setup" },
  ],
  team_member: [
    { key: "nav.messages", icon: MessageSquare, href: "/team/messages", group: "nav.group.comms" },

    { key: "nav.myWork", icon: LayoutDashboard, href: "/team", group: "nav.group.work" },
    { key: "nav.cases", icon: ClipboardList, href: "/team/cases", group: "nav.group.work" },
    { key: "nav.appointments", icon: CalendarDays, href: "/team/appointments", group: "nav.group.work" },
    { key: "nav.submitNew", icon: UserPlus, href: "/team/submit", group: "nav.group.work" },
    { key: "nav.students", icon: GraduationCap, href: "/team/students", group: "nav.group.work" },

    { key: "nav.analytics", icon: BarChart2, href: "/team/analytics", group: "nav.group.setup" },
    { key: "nav.spreadsheet", icon: Table, href: "/team/spreadsheet", group: "nav.group.setup" },

    {
      key: "nav.group.tools",
      icon: Wrench,
      href: "",
      children: [
        { key: "nav.bagrut", icon: Calculator, href: "/team/bagrut" },
        { key: "nav.cvBuilder", icon: FileText, href: "/team/tools/cv" },
        { key: "nav.currency", icon: DollarSign, href: "/team/tools/currency" },
      ],
    },
  ],

  social_media_partner: [
    ...PARTNER_BASE_NAV,
    { key: "nav.apply", icon: ClipboardEdit, href: "/partner/apply", group: "nav.group.work" },
  ],
  ambassador: [...PARTNER_BASE_NAV],
  student: [
    { key: "nav.nextSteps", icon: Sparkles, href: "/student" },
    {
      key: "nav.group.studyFile",
      icon: BookOpen,
      href: "",
      children: [
        { key: "nav.checklist", icon: ListChecks, href: "/student/checklist" },
        { key: "nav.documents", icon: FileText, href: "/student/documents" },
        { key: "nav.visa", icon: Globe, href: "/student/visa" },
        { key: "nav.fees", icon: Receipt, href: "/student/fees" },
      ],
    },
    {
      key: "nav.group.communication",
      icon: MessageSquare,
      href: "",
      children: [
        { key: "nav.messages", icon: MessageSquare, href: "/student/messages" },
        { key: "nav.contacts", icon: Users, href: "/student/contacts" },
      ],
    },
    {
      key: "nav.group.account",
      icon: User,
      href: "",
      children: [
        { key: "nav.profile", icon: User, href: "/student/profile" },
        { key: "nav.myData", icon: ShieldCheck, href: "/student/my-data" },
      ],
    },
    {
      key: "nav.group.tools",
      icon: Wrench,
      href: "",
      children: [
        { key: "nav.bagrut", icon: Calculator, href: "/student/tools/bagrut" },
        { key: "nav.cvBuilder", icon: FileText, href: "/student/tools/cv" },
      ],
    },
    { key: "nav.refer", icon: Heart, href: "/student/refer" },
  ],

};

function SidebarNav({ role }: { role: AppRole }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { t, i18n } = useTranslation("dashboard");
  const { isMaster } = useIsMasterPartner();
  const { isManager } = useIsManager();
  const baseItems = NAV_CONFIG[role] ?? [];
  const isPartnerRole = role === "social_media_partner" || role === "ambassador";
  const items: NavItem[] = isMaster && isPartnerRole
    ? [
        ...baseItems,
        { key: "nav.network", icon: Crown, href: "/partner/network", group: "nav.group.work" },
        { key: "nav.performance", icon: BarChart2, href: "/partner/performance", group: "nav.group.work" },
      ]
    : isManager && role === "team_member"
      ? [
          ...baseItems,
          { key: "nav.pipeline", icon: GitBranch, href: "/team/pipeline", group: "nav.group.work" },
        ]
      : baseItems;
  const unreadMessages = useUnreadCaseMessages(true);

  const isItemActive = (item: NavItem): boolean => {
    if (!item.href) return false;
    const exactHomeRoles = ["/admin", "/team", "/partner"];
    return (
      location.pathname === item.href ||
      (!exactHomeRoles.includes(item.href) &&
        item.href !== "/student/checklist" &&
        location.pathname.startsWith(item.href))
    );
  };

  const isParentActive = (parent: NavItem): boolean =>
    !!parent.children?.some((child) => isItemActive(child));

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // Auto-expand the group containing the active route; collapse the rest.
  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const item of items) {
      if (item.children?.length) next[item.key] = isParentActive(item);
    }
    setOpenGroups(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, role]);

  return (
    <SidebarContent>
      <div
        className={cn(
          "flex items-center border-b border-border/50 transition-all duration-200",
          collapsed ? "h-14 justify-center px-2" : "h-14 px-4",
        )}
      >
        {!collapsed && (
          <Link to="/" className="font-bold text-lg text-primary tracking-tight">
            DARB
          </Link>
        )}
        {collapsed && <span className="font-bold text-primary text-sm">D</span>}
      </div>

      <SidebarMenu className="mt-2 px-2">
        {items.map((item, index) => {
          const isActive = isItemActive(item);
          const showGroup = !!item.group && item.group !== items[index - 1]?.group;

          if (item.children?.length) {
            const parentActive = isParentActive(item);
            const open = !!openGroups[item.key] || collapsed;
            return (
              <React.Fragment key={item.key}>
                {showGroup && !collapsed && (
                  <p className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {t(item.group as string, item.group as string)}
                  </p>
                )}
                <SidebarMenuItem>
                  <Collapsible
                    open={open}
                    onOpenChange={(o) => setOpenGroups((prev) => ({ ...prev, [item.key]: o }))}
                  >
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton asChild>
                        <button
                          type="button"
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors w-full",
                            "hover:bg-accent hover:text-accent-foreground",
                            parentActive && "bg-primary/10 text-primary font-medium",
                            collapsed && "justify-center px-2",
                          )}
                          title={collapsed ? t(item.key, item.key) : undefined}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          {!collapsed && <span className="flex-1 text-start">{t(item.key, item.key)}</span>}
                          {!collapsed && (
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                                open && "rotate-180",
                              )}
                            />
                          )}
                        </button>
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    {!collapsed && (
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {item.children.map((child) => {
                            const childActive = isItemActive(child);
                            return (
                              <SidebarMenuSubItem key={child.key}>
                                <SidebarMenuSubButton asChild isActive={childActive}>
                                  <Link
                                    to={child.href}
                                    className={cn(
                                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                                      "hover:bg-accent hover:text-accent-foreground",
                                      childActive && "bg-primary/10 text-primary font-medium",
                                    )}
                                  >
                                    <child.icon className="h-4 w-4 shrink-0" />
                                    <span>{t(child.key, child.key)}</span>
                                    {child.key === "nav.messages" && unreadMessages > 0 && (
                                      <span className="ms-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground">
                                        {unreadMessages}
                                      </span>
                                    )}
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            );
                          })}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    )}
                  </Collapsible>
                </SidebarMenuItem>
              </React.Fragment>
            );
          }

          return (
            <React.Fragment key={item.key}>
              {showGroup && !collapsed && (
                <p className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t(item.group as string, item.group as string)}
                </p>
              )}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link
                    to={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      isActive && "bg-primary/10 text-primary font-medium",
                      collapsed && "justify-center px-2",
                    )}
                    title={collapsed ? t(item.key, item.key) : undefined}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>{t(item.key, item.key)}</span>}
                    {item.key === "nav.messages" && unreadMessages > 0 && (
                      <span className="ms-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground">
                        {unreadMessages}
                      </span>
                    )}
                  </Link>

                </SidebarMenuButton>
              </SidebarMenuItem>
            </React.Fragment>
          );
        })}
      </SidebarMenu>
    </SidebarContent>
  );
}

interface DashboardLayoutProps {
  role: AppRole;
}

export default function DashboardLayout({ role }: DashboardLayoutProps) {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation("dashboard");
  const isRtl = i18n.language === "ar";
  const canMessage = role === "admin" || role === "team_member";
  const headerUnread = useUnreadCaseMessages(canMessage);
  const messagesHref = role === "admin" ? "/admin/messages" : "/team/messages";
  /* Theme is owned entirely by ThemeScope/next-themes — no manual class work. */




  /** A mobile conversation owns the whole screen; hide the tab bar under it. */
  const chatFullscreen = useChatFullscreenActive();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <SidebarProvider>
      <div className={cn("flex h-screen w-full overflow-hidden bg-background", isRtl && "dir-rtl")}>
        <Sidebar side={isRtl ? "right" : "left"} collapsible="icon">
          <SidebarNav role={role} />
        </Sidebar>

        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Top header */}
          <header className="h-14 border-b border-border/50 flex items-center justify-between px-4 shrink-0 bg-background/95 backdrop-blur sticky top-0 z-10">
            <SidebarTrigger />
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <ThemeToggle />

              {canMessage && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={location.pathname.startsWith(messagesHref) ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => navigate(messagesHref)}
                        aria-label={t("nav.messages")}
                        className="relative gap-2 text-muted-foreground hover:text-foreground"
                      >
                        <MessageSquare className="h-4 w-4" />
                        <span className="hidden sm:inline text-xs">{t("nav.messages")}</span>
                        {headerUnread > 0 && (
                          <span className="absolute -top-1 -end-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                            {headerUnread}
                          </span>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t("nav.messages")}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {user && <NotificationBell />}

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate("/")}
                      className="gap-2 text-muted-foreground hover:text-foreground"
                    >
                      <Home className="h-4 w-4" />
                      <span className="hidden sm:inline text-xs">{t("nav.mainSite")}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("nav.backToMainSite")}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="gap-2 text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>

          {/* Page content */}
          <main className={cn("flex-1 min-w-0 overflow-y-auto overflow-x-hidden md:pb-0", chatFullscreen ? "pb-0" : "pb-16")}>
            <TabErrorBoundary>
              <Outlet />
            </TabErrorBoundary>
          </main>
          {!chatFullscreen && <MobileBottomNav role={role} />}
          <NotificationOnboardingDialog />
        </div>
      </div>
    </SidebarProvider>
  );
}
