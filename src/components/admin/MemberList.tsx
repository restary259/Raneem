import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Users, Shield, Handshake, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatILS } from "@/lib/money";

export interface MemberRow {
  requester_id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  city: string | null;
  created_at: string;
  role: string;
  referral_code: string | null;
  agent_id: string | null;
  is_deactivated: boolean;
  assigned_cases: number;
  enrolled_cases: number;
  team_reward_total: number;
  recruited_count: number;
  earned_override: number;
  students_count: number;
  earned_referral: number;
  total_earned: number;
  paid_amount: number;
  locked_amount: number;
  available_amount: number;
  open_requests: number;
  open_request_amount: number;
  last_request_at: string | null;
}

interface MemberListProps {
  members: MemberRow[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onRowClick: (member: MemberRow) => void;
  emptyMessage: string;
  tabKey: string;
}

const ROLE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  team_member: Users,
  agent: Shield,
  social_media_partner: Handshake,
  ambassador: UserCheck,
};

const ROLE_LABELS: Record<string, string> = {
  team_member: "admin.members.roleTeamMember",
  agent: "admin.members.roleAgent",
  social_media_partner: "admin.members.rolePartner",
  ambassador: "admin.members.roleAmbassador",
};

function getPrimaryKPI(member: MemberRow): { label: string; value: string } {
  switch (member.role) {
    case "team_member":
      return { label: "admin.members.kpiEnrolled", value: String(member.enrolled_cases) };
    case "agent":
      return { label: "admin.members.kpiNetworkEnrolled", value: String(member.enrolled_cases ?? 0) };
    case "social_media_partner":
    case "ambassador":
      return { label: "admin.members.kpiEnrolled", value: String(member.students_count) };
    default:
      return { label: "admin.members.kpiTotal", value: String(member.total_earned ? formatILS(member.total_earned) : "₪0") };
  }
}

export default function MemberList({
  members,
  loading,
  error,
  onRetry,
  onRowClick,
  emptyMessage,
  tabKey,
}: MemberListProps) {
  const { t } = useTranslation("dashboard");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return members;
    const q = search.toLowerCase();
    return members.filter(
      (m) =>
        m.full_name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.phone_number?.toLowerCase().includes(q) ||
        m.city?.toLowerCase().includes(q),
    );
  }, [members, search]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("admin.members.searchPlaceholder", "Search by name, email, phone, city…")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled
            className="w-64"
          />
        </div>
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="flex items-center gap-4 border-b border-border bg-muted/40 px-4 py-3">
            <Skeleton className="h-3 w-28 rounded" />
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="hidden h-3 w-1/5 rounded sm:block" />
            <Skeleton className="ms-auto h-6 w-16 rounded-full" />
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-b-0">
              <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
              <Skeleton className="h-3.5 w-1/3 rounded" />
              <Skeleton className="hidden h-3 w-1/5 rounded sm:block" />
              <Skeleton className="ms-auto h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-10 text-center" role="alert">
        <div className="mb-3 h-8 w-8 text-destructive/70">
          <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <p className="text-sm font-medium text-foreground">{t("admin.members.loadError", "Failed to load members")}</p>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">{error}</p>
        <button
          type="button"
          className="mt-4 rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-accent"
          onClick={onRetry}
        >
          {t("common.retry", "Retry")}
        </button>
      </div>
    );
  }

  if (filtered.length === 0) {
    const EmptyIcon = ROLE_ICONS[tabKey];
    return (
      <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
        <div className="mb-3 h-9 w-9 text-muted-foreground/40">
          {EmptyIcon && <EmptyIcon className="h-9 w-9" />}
        </div>
        <p className="text-sm font-medium text-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("admin.members.searchPlaceholder", "Search by name, email, phone, city…")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
        <span className="ms-auto text-xs text-muted-foreground">
          {t("admin.members.showing", "Showing {{count}} of {{total}}", { count: filtered.length, total: members.length })}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border bg-muted/40">
              <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t("admin.members.colMember", "Member")}
              </TableHead>
              <TableHead className="hidden px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider sm:table-cell">
                {t("admin.members.colRole", "Role")}
              </TableHead>
              <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t("admin.members.colPrimaryKPI", "Primary KPI")}
              </TableHead>
              <TableHead className="ms-auto px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t("admin.members.colStatus", "Status")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((member) => {
              const primaryKPI = getPrimaryKPI(member);
              const RoleIcon = ROLE_ICONS[member.role] || Users;
              const roleLabel = t(ROLE_LABELS[member.role] || member.role);

              return (
                <TableRow
                  key={member.requester_id}
                  className={cn(
                    "cursor-pointer hover:bg-muted/50 transition-colors",
                    member.is_deactivated && "opacity-50",
                  )}
                  onClick={() => onRowClick(member)}
                >
                  <TableCell className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
                        <RoleIcon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{member.full_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden px-4 py-3 sm:table-cell">
                    <Badge variant="secondary" className="text-xs gap-1">
                      <RoleIcon className="h-3 w-3" />
                      {roleLabel}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium tabular-nums">{primaryKPI.value}</span>
                      <span className="text-xs text-muted-foreground">{t(primaryKPI.label)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="ms-auto px-4 py-3 text-right">
                    <Badge variant={member.is_deactivated ? "destructive" : "outline"} className="text-xs">
                      {member.is_deactivated
                        ? t("admin.members.statusDeactivated", "Deactivated")
                        : t("admin.members.statusActive", "Active")}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}