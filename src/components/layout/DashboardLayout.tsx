import React, { useEffect, useMemo, useState } from "react";

import { Link, Outlet, useLocation, useNavigate } from "@/lib/router-compat";
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
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import NotificationOnboardingDialog from "@/components/notifications/NotificationOnboardingDialog";
import TabErrorBoundary from "@/components/common/TabErrorBoundary";
import StudentSidebarFooter from "@/components/student/StudentSidebarFooter";
import { useAuth, AppRole } from "@/contexts/AuthContext";
import { useUnreadCaseMessages } from "@/hooks/useUnreadCaseMessages";
import { useAppBadge } from "@/hooks/useAppBadge";
import { useApplyFormEnabled } from "@/hooks/useApplyFormEnabled";
import { useGoogleBusinessAccess } from "@/hooks/useGoogleBusinessAccess";
import {
  getDashboardNav,
  matchesDashboardNavPath,
  resolveDashboardNavItems,
  type DashboardNavItem,
} from "@/components/layout/dashboardNavigation";
import DashboardHeader from "@/components/layout/DashboardHeader";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import { useChatFullscreenActive } from "@/components/messages/chatFullscreen";
import { cn } from "@/lib/utils";

function SidebarNav({ role }: { role: AppRole }) {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { t, i18n } = useTranslation("dashboard");
  const baseItems = getDashboardNav(role).desktop;
  const applyFormEnabled = useApplyFormEnabled(
    role === "social_media_partner" || role === "ambassador" || role === "agent",
  );
  const googleBusinessAccess = useGoogleBusinessAccess(role === "team_member");
  const items = useMemo(
    () =>
      resolveDashboardNavItems(role, baseItems, {
        applyFormEnabled,
        googleBusinessAccess,
      }),
    [baseItems, role, applyFormEnabled, googleBusinessAccess],
  );
  const unreadMessages = useUnreadCaseMessages(true);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const isItemActive = (item: DashboardNavItem): boolean =>
    matchesDashboardNavPath(location.pathname, item);

  const isParentActive = (item: DashboardNavItem): boolean =>
    !!item.children?.some((child) => isItemActive(child));

  useEffect(() => {
    const next: Record<string, boolean> = {};
    for (const item of items) {
      if (item.children?.length) next[item.key] = isParentActive(item);
    }
    setOpenGroups(next);
  }, [items, location.pathname, role]);

  const closeMobileSidebar = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <SidebarContent>
      <div
        className={cn(
          "flex items-center border-b border-border/50 transition-all duration-200",
          collapsed ? "h-14 justify-center px-2" : "h-14 px-4",
        )}
      >
        {!collapsed && (
          <Link
            to="/"
            onClick={closeMobileSidebar}
            className="font-bold text-lg text-primary tracking-tight"
          >
            {i18n.language.startsWith("ar") ? "درب" : "DARB"}
          </Link>
        )}
        {collapsed && (
          <span className="font-bold text-primary text-sm">
            {i18n.language.startsWith("ar") ? "د" : "D"}
          </span>
        )}
      </div>

      <SidebarMenu className="mt-2 px-2">
        {items.map((item, index) => {
          const showGroup =
            !!item.group && item.group !== items[index - 1]?.group;

          if (item.children?.length) {
            const parentActive = isParentActive(item);
            const open = !!openGroups[item.key] || collapsed;

            return (
              <React.Fragment key={item.key}>
                {showGroup && !collapsed && (
                  <p className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {t(item.group!)}
                  </p>
                )}
                <SidebarMenuItem>
                  <Collapsible
                    open={open}
                    onOpenChange={(value) =>
                      setOpenGroups((prev) => ({ ...prev, [item.key]: value }))
                    }
                  >
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton asChild>
                        <button
                          type="button"
                          className={cn(
                            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                            "hover:bg-accent hover:text-accent-foreground",
                            parentActive && "bg-primary/10 text-primary font-medium neon-active neon-primary",
                            collapsed && "justify-center px-2",
                          )}
                          title={collapsed ? t(item.key) : undefined}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          {!collapsed && <span className="flex-1 text-start">{t(item.key)}</span>}
                          {!collapsed && (
                            <span
                              aria-hidden="true"
                              className={cn(
                                "text-muted-foreground transition-transform",
                                open && "rotate-180",
                              )}
                            >
                              ▾
                            </span>
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
                                    onClick={closeMobileSidebar}
                                    className={cn(
                                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                                      "hover:bg-accent hover:text-accent-foreground",
                                      childActive && "bg-primary/10 text-primary font-medium neon-active neon-primary",
                                    )}
                                  >
                                    <child.icon className="h-4 w-4 shrink-0" />
                                    <span>{t(child.key)}</span>
                                    {child.key === "nav.messages" && unreadMessages > 0 && (
                                      <span className="ms-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground neon-dot neon-danger">
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

          const isActive = isItemActive(item);

          return (
            <React.Fragment key={item.key}>
              {showGroup && !collapsed && (
                <p className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t(item.group!)}
                </p>
              )}
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link
                    to={item.href}
                    onClick={closeMobileSidebar}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      isActive && "bg-primary/10 text-primary font-medium neon-active neon-primary",
                      collapsed && "justify-center px-2",
                    )}
                    title={collapsed ? t(item.key) : undefined}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>{t(item.key)}</span>}
                    {item.key === "nav.messages" && unreadMessages > 0 && (
                      <span className="ms-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground neon-dot neon-danger">
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
  const { i18n } = useTranslation("dashboard");
  const isRtl = i18n.language.startsWith("ar") || i18n.language.startsWith("he");
  const chatFullscreen = useChatFullscreenActive();
  const mainRef = React.useRef<HTMLElement>(null);

  useAppBadge();

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  useEffect(() => {
    const els = [document.documentElement, document.body];
    els.forEach((el) => el.classList.add("dashboard-locked"));
    return () => els.forEach((el) => el.classList.remove("dashboard-locked"));
  }, []);

  return (
    <SidebarProvider>
      <div
        className={cn(
          "fixed inset-0 flex h-[100dvh] w-full overflow-hidden overscroll-none bg-background",
          isRtl && "dir-rtl",
        )}
      >
        <Sidebar side={isRtl ? "right" : "left"} collapsible="icon">
          <SidebarNav role={role} />
          {role === "student" && (
            <StudentSidebarFooter user={user} onSignOut={handleSignOut} />
          )}
        </Sidebar>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className={cn(chatFullscreen && "hidden")}>
            <DashboardHeader role={role} user={user} onSignOut={handleSignOut} />
          </div>

          <main
            ref={mainRef}
            className={cn(
              "min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-none md:pb-0",
              chatFullscreen
                ? "pb-0"
                : "pb-[calc(4rem+env(safe-area-inset-bottom))]",
            )}
          >
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
