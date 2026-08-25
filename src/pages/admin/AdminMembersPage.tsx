import React, { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { RefreshCw, Users, Shield, Handshake, UserCheck, Plus } from "lucide-react";
import TabHub, { HubTab } from "@/components/shell/TabHub";
import MemberList from "@/components/admin/MemberList";
import MemberDetailDrawer from "@/components/admin/MemberDetailDrawer";
import CreateMemberDialog from "@/components/admin/CreateMemberDialog";
import PendingInvitations from "@/components/admin/PendingInvitations";
import { normalizeEmail } from "@/lib/studentInvitations";

interface MemberRow {
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
  /** Enrolled cases the account referred personally. */
  direct_enrolled_cases: number;
  /** Enrolled cases referred by the partners/ambassadors an agent recruited. */
  network_enrolled_cases: number;
}

async function fetchMembers(role?: string): Promise<MemberRow[]> {
  const { data, error } = await (supabase.rpc as any)("get_members_directory", {
    p_role: role,
  });
  if (error) throw error;
  return ((data as unknown) as MemberRow[]) || [];
}

const AdminMembersPage: React.FC = () => {
  const { t } = useTranslation("dashboard");
  const [searchParams] = useSearchParams();

  const [selectedMember, setSelectedMember] = useState<MemberRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [invitesRefreshKey, setInvitesRefreshKey] = useState(0);

  // Team tab (team_member)
  const {
    data: teamMembers = [],
    isLoading: teamLoading,
    error: teamError,
    refetch: refetchTeam,
  } = useQuery({
    queryKey: ["admin", "members", "team_member"],
    queryFn: () => fetchMembers("team_member"),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  // Agents tab (agent)
  const {
    data: agentMembers = [],
    isLoading: agentLoading,
    error: agentError,
    refetch: refetchAgents,
  } = useQuery({
    queryKey: ["admin", "members", "agent"],
    queryFn: () => fetchMembers("agent"),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  // Partners tab (social_media_partner)
  const {
    data: partnerMembers = [],
    isLoading: partnerLoading,
    error: partnerError,
    refetch: refetchPartners,
  } = useQuery({
    queryKey: ["admin", "members", "social_media_partner"],
    queryFn: () => fetchMembers("social_media_partner"),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  // Ambassadors tab (ambassador)
  const {
    data: ambassadorMembers = [],
    isLoading: ambassadorLoading,
    error: ambassadorError,
    refetch: refetchAmbassadors,
  } = useQuery({
    queryKey: ["admin", "members", "ambassador"],
    queryFn: () => fetchMembers("ambassador"),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  // Active member emails across all staff roles — a pending invitation whose
  // email matches one of these is not genuinely pending (its account is
  // already live) and is hidden from the Pending Invitations list.
  const activeMemberEmails = useMemo(() => {
    const emails = new Set<string>();
    for (const member of [...teamMembers, ...agentMembers, ...partnerMembers, ...ambassadorMembers]) {
      if (member.is_deactivated) continue;
      const email = normalizeEmail(member.email);
      if (email) emails.add(email);
    }
    return [...emails];
  }, [teamMembers, agentMembers, partnerMembers, ambassadorMembers]);

  const handleOpenDrawer = useCallback((member: MemberRow) => {
    setSelectedMember(member);
    setDrawerOpen(true);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setDrawerOpen(false);
    setSelectedMember(null);
  }, []);

  const handleRetry = useCallback((refetch: () => void) => {
    refetch();
  }, []);

  const handleRefreshAll = useCallback(async () => {
    setInvitesRefreshKey((n) => n + 1);
    await Promise.allSettled([refetchTeam(), refetchAgents(), refetchPartners(), refetchAmbassadors()]);
  }, [refetchTeam, refetchAgents, refetchPartners, refetchAmbassadors]);

  const handleCreated = useCallback(() => {
    setInvitesRefreshKey((n) => n + 1);
    Promise.allSettled([refetchTeam(), refetchAgents(), refetchPartners(), refetchAmbassadors()]);
  }, [refetchTeam, refetchAgents, refetchPartners, refetchAmbassadors]);

  const activeRole =
    (searchParams.get("tab") === "agents" && "agent") ||
    (searchParams.get("tab") === "partners" && "social_media_partner") ||
    (searchParams.get("tab") === "ambassadors" && "ambassador") ||
    "team_member";

  const tabs: HubTab[] = [
    {
      value: "team",
      label: t("admin.members.tabTeam", "Team"),
      icon: Users,
      count: teamMembers.length,
      render: () => (
        <MemberList
          members={teamMembers}
          loading={teamLoading}
          error={teamError?.message ?? null}
          onRetry={() => handleRetry(refetchTeam)}
          onRowClick={handleOpenDrawer}
          emptyMessage={t("admin.members.emptyTeam", "No team members yet. Invite your first member to get started.")}
          tabKey="team_member"
        />
      ),
    },
    {
      value: "agents",
      label: t("admin.members.tabAgents", "Agents"),
      icon: Shield,
      count: agentMembers.length,
      render: () => (
        <MemberList
          members={agentMembers}
          loading={agentLoading}
          error={agentError?.message ?? null}
          onRetry={() => handleRetry(refetchAgents)}
          onRowClick={handleOpenDrawer}
          emptyMessage={t("admin.members.emptyAgents", "No agents yet. Create an agent from the Team tab or the Commission Hub.")}
          tabKey="agent"
        />
      ),
    },
    {
      value: "partners",
      label: t("admin.members.tabPartners", "Partners"),
      icon: Handshake,
      count: partnerMembers.length,
      render: () => (
        <MemberList
          members={partnerMembers}
          loading={partnerLoading}
          error={partnerError?.message ?? null}
          onRetry={() => handleRetry(refetchPartners)}
          onRowClick={handleOpenDrawer}
          emptyMessage={t("admin.members.emptyPartners", "No partners yet. Partners are created via the apply flow or admin invite.")}
          tabKey="social_media_partner"
        />
      ),
    },
    {
      value: "ambassadors",
      label: t("admin.members.tabAmbassadors", "Ambassadors"),
      icon: UserCheck,
      count: ambassadorMembers.length,
      render: () => (
        <MemberList
          members={ambassadorMembers}
          loading={ambassadorLoading}
          error={ambassadorError?.message ?? null}
          onRetry={() => handleRetry(refetchAmbassadors)}
          onRowClick={handleOpenDrawer}
          emptyMessage={t("admin.members.emptyAmbassadors", "No ambassadors yet. Ambassadors are created via the apply flow or admin invite.")}
          tabKey="ambassador"
        />
      ),
    },
  ];

  const handleDrawerChanged = useCallback(() => {
    const role = selectedMember?.role;
    if (role === "agent") refetchAgents();
    else if (role === "social_media_partner") refetchPartners();
    else if (role === "ambassador") refetchAmbassadors();
    else refetchTeam();
  }, [selectedMember?.role, refetchAgents, refetchPartners, refetchAmbassadors, refetchTeam]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            {t("admin.members.title", "Team Members")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("admin.members.subtitle", "Manage team members, agents, partners and ambassadors")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefreshAll} disabled={teamLoading || agentLoading || partnerLoading || ambassadorLoading}>
            <RefreshCw className="h-4 w-4 me-2" />
            {t("common.refresh", "Refresh")}
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 me-2" />
            {t("admin.members.createMember", "Create Member")}
          </Button>
        </div>
      </div>

      {/* Error banners per tab - shown only when that tab's data fails */}
      {(teamError || agentError || partnerError || ambassadorError) && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/5 border border-destructive/20 text-sm">
          <svg className="h-5 w-5 text-destructive shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div className="flex-1">
            <p className="font-medium text-destructive">
              {t("admin.members.loadError", "Failed to load some member data")}
            </p>
            <p className="text-muted-foreground text-xs mt-1">
              {teamError?.message || agentError?.message || partnerError?.message || ambassadorError?.message}
            </p>
          </div>
        </div>
      )}

      <PendingInvitations refreshKey={invitesRefreshKey} activeEmails={activeMemberEmails} />
      <TabHub tabs={tabs} param="tab" />
      <MemberDetailDrawer member={selectedMember} open={drawerOpen} onOpenChange={handleCloseDrawer} onChanged={handleDrawerChanged} />
      <CreateMemberDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultRole={activeRole}
        onCreated={handleCreated}
      />
    </div>
  );
};

export default AdminMembersPage;