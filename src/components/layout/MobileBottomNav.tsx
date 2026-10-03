import { useTranslation } from "react-i18next";
import { Link, useLocation } from "@/lib/router-compat";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/contexts/AuthContext";
import { useApplyFormEnabled } from "@/hooks/useApplyFormEnabled";
import {
  getDashboardNav,
  matchesDashboardNavPath,
  resolveDashboardNavItems,
  type DashboardNavItem,
} from "@/components/layout/dashboardNavigation";

interface MobileBottomNavProps {
  role: AppRole;
}

export default function MobileBottomNav({ role }: MobileBottomNavProps) {
  const location = useLocation();
  const { t } = useTranslation("dashboard");
  const baseItems = getDashboardNav(role).mobilePrimary;
  const applyFormEnabled = useApplyFormEnabled(
    role === "social_media_partner" || role === "ambassador" || role === "agent",
  );
  const items = resolveDashboardNavItems(role, baseItems, { applyFormEnabled });

  const label = (item: DashboardNavItem) =>
    t(item.mobileLabelKey ?? item.key);

  const tabClass = (active: boolean) =>
    cn(
      "relative flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2",
      "text-[10px] font-medium transition-colors",
      "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
      active ? "text-primary" : "text-muted-foreground hover:text-foreground",
    );

  return (
    <nav
      role="navigation"
      aria-label={t("nav.bottomNav")}
      className="fixed bottom-0 start-0 end-0 z-50 flex min-h-16 items-stretch border-t border-border bg-background/95 shadow-[0_-8px_24px_-20px_hsl(var(--foreground)/0.35)] backdrop-blur-md pb-safe md:hidden"
    >
      {items.map((item) => {
        const isActive = matchesDashboardNavPath(location.pathname, item);
        const labelText = label(item);

        return (
          <Link
            key={item.key}
            to={item.href}
            aria-current={isActive ? "page" : undefined}
            aria-label={labelText}
            className={tabClass(isActive)}
          >
            <item.icon
              className={cn("h-5 w-5 shrink-0", isActive && "text-primary")}
              aria-hidden="true"
            />
            <span className="w-full min-w-0 max-w-[84px] text-center leading-tight break-words">
              {labelText}
            </span>
            {isActive && (
              <span
                aria-hidden="true"
                className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
