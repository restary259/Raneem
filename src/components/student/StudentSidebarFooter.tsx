import { Link } from "@/lib/router-compat";
import { useTranslation } from "react-i18next";
import { LogOut, ShieldCheck, User } from "lucide-react";
import { SidebarFooter, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface UserLike {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}

interface StudentSidebarFooterProps {
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

export default function StudentSidebarFooter({ user, onSignOut }: StudentSidebarFooterProps) {
  const { t } = useTranslation("dashboard");
  const displayName = getDisplayName(user, t("nav.student", "Student"));
  const initials = getInitials(displayName);

  return (
    <SidebarFooter className="border-t border-sidebar-border/60">
      <SidebarMenu className="gap-1">
        <SidebarMenuItem>
          <SidebarMenuButton asChild tooltip={displayName}>
            <Link to="/student/profile" className="flex min-w-0 items-center gap-3">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{displayName}</span>
              <User className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>

        <SidebarMenuItem>
          <SidebarMenuButton asChild tooltip={t("nav.myData", "My data")}>
            <Link to="/student/my-data" className="flex items-center gap-3">
              <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{t("nav.myData", "My data")}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>

        <SidebarMenuItem>
          <SidebarMenuButton
            type="button"
            tooltip={t("header.signOut", "Sign out")}
            onClick={() => void onSignOut()}
            className="w-full text-destructive hover:text-destructive"
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{t("header.signOut", "Sign out")}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  );
}
