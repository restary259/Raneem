import React, { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import NotificationBell from "@/components/common/NotificationBell";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import TabErrorBoundary from "@/components/common/TabErrorBoundary";
import LanguageSwitcher from "@/components/common/LanguageSwitcher";
import { useAuth, AppRole } from "@/contexts/AuthContext";
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
  Home,
  Table,
  Calculator,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface NavItem {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  /** i18n key of the sidebar group heading this item belongs to */
  group?: string;
}

const NAV_CONFIG: Record<AppRole, NavItem[]> = {
  admin: [
    { key: "nav.overview", icon: LayoutDashboard, href: "/admin", group: "nav.group.work" },
    { key: "nav.pipeline", icon: GitBranch, href: "/admin/pipeline", group: "nav.group.work" },
    { key: "nav.submissions", icon: FileCheck, href: "/admin/submissions", group: "nav.group.work" },
    { key: "nav.inbox", icon: Inbox, href: "/admin/inbox", group: "nav.group.work" },
    { key: "nav.messages", icon: MessageSquare, href: "/admin/messages", group: "nav.group.work" },

    { key: "nav.financials", icon: DollarSign, href: "/admin/financials", group: "nav.group.money" },
    { key: "nav.spreadsheet", icon: Table, href: "/admin/spreadsheet", group: "nav.group.money" },
    { key: "nav.analytics", icon: BarChart2, href: "/admin/analytics", group: "nav.group.money" },
    { key: "nav.team", icon: Users, href: "/admin/team", group: "nav.group.people" },
    { key: "nav.students", icon: GraduationCap, href: "/admin/students", group: "nav.group.people" },
    { key: "nav.programs", icon: BookOpen, href: "/admin/programs", group: "nav.group.setup" },
    { key: "nav.activity", icon: Activity, href: "/admin/activity", group: "nav.group.setup" },
    { key: "nav.settings", icon: Settings, href: "/admin/settings", group: "nav.group.setup" },
  ],
  team_member: [
    { key: "nav.myWork", icon: LayoutDashboard, href: "/team" },
    { key: "nav.cases", icon: ClipboardList, href: "/team/cases" },
    { key: "nav.appointments", icon: CalendarDays, href: "/team/appointments" },
    { key: "nav.submitNew", icon: UserPlus, href: "/team/submit" },
    { key: "nav.students", icon: GraduationCap, href: "/team/students" },
    { key: "nav.bagrut", icon: Calculator, href: "/team/bagrut" },
    { key: "nav.analytics", icon: BarChart2, href: "/team/analytics" },
    { key: "nav.spreadsheet", icon: Table, href: "/team/spreadsheet" },
  ],
  social_media_partner: [
    { key: "nav.overview", icon: LayoutDashboard, href: "/partner" },
    { key: "nav.students", icon: GraduationCap, href: "/partner/students" },
    { key: "nav.earnings", icon: TrendingUp, href: "/partner/earnings" },
  ],
  ambassador: [
    { key: "nav.overview", icon: LayoutDashboard, href: "/partner" },
    { key: "nav.students", icon: GraduationCap, href: "/partner/students" },
    { key: "nav.earnings", icon: TrendingUp, href: "/partner/earnings" },
  ],
  student: [
    { key: "nav.nextSteps", icon: Sparkles, href: "/student" },
    { key: "nav.checklist", icon: ListChecks, href: "/student/checklist" },
    { key: "nav.profile", icon: User, href: "/student/profile" },
    { key: "nav.documents", icon: FileText, href: "/student/documents" },
    { key: "nav.visa", icon: Globe, href: "/student/visa" },
    { key: "nav.refer", icon: Heart, href: "/student/refer" },
    { key: "nav.contacts", icon: Users, href: "/student/contacts" },
  ],
};

function SidebarNav({ role }: { role: AppRole }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { t, i18n } = useTranslation("dashboard");
  const items = NAV_CONFIG[role] ?? [];

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
          const isActive =
            location.pathname === item.href ||
            (item.href !== "/admin" &&
              item.href !== "/team" &&
              item.href !== "/partner" &&
              item.href !== "/student/checklist" &&
              location.pathname.startsWith(item.href));
          const showGroup = !!item.group && item.group !== items[index - 1]?.group;
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
  const { t, i18n } = useTranslation("dashboard");
  const isRtl = i18n.language === "ar";

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
          <main className="flex-1 overflow-auto pb-16 md:pb-0">
            <TabErrorBoundary>
              <Outlet />
            </TabErrorBoundary>
          </main>
          <MobileBottomNav role={role} />
        </div>
      </div>
    </SidebarProvider>
  );
}
