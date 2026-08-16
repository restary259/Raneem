import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

export interface CommissionHubOverview {
  team_members_total: number;
  partners_total: number;
  partners_custom: number;
  partners_at_zero: number;
  ambassadors_total: number;
  agents_total: number;
  agents_custom: number;
  students_total: number;
  student_overrides: number;
  independent_partners: number;
  master_partners: number;
  global_rates: {
    partner: number;
    ambassador: number;
    team: number;
    master_share: number;
    agent: number;
    agent_self_referral: number;
    referral_discount: number;
    student_friend_discount: number;
    student_friend_reward: number;
    student_family_discount: number;
    student_family_reward: number;
  };
  recent_changes: CommissionRateChange[];
}

export interface CommissionRateChange {
  id: string;
  entity_type: string;
  entity_id: string | null;
  rate_kind: string;
  old_value: number | null;
  new_value: number | null;
  changed_by: string | null;
  changed_at: string;
  reason: string | null;
}

export interface IndependentAccount {
  id: string;
  name: string;
  email: string;
  role: string;
  override: number | null;
  students_referred: number;
  earned: number;
}

export interface AgentListItem {
  id: string;
  name: string;
  email: string;
  override: number | null;
  global_rate: number;
  students_referred: number;
  earned: number;
}

export interface TeamMemberCommission {
  id: string;
  name: string;
  email: string;
  override: number | null;
}

export interface StudentReferralConfig {
  global: {
    friend_discount: number;
    friend_reward: number;
    family_discount: number;
    family_reward: number;
  };
  overrides: Array<{
    id: string;
    student_id: string;
    referral_type: "friend" | "family";
    reward_amount: number;
    notes: string | null;
    full_name: string;
    email: string;
  }>;
}

export interface AccountCommissionHistory {
  account: {
    id: string;
    name: string;
    email: string;
    role: string;
    agent_id: string | null;
    master_partner_id: string | null;
    is_master_partner: boolean;
  };
  rewards: Array<Record<string, unknown>>;
  totals: {
    total: number;
    pending: number;
    paid: number;
    by_type: Record<string, number>;
  };
  rate_changes: CommissionRateChange[];
}

export const useCommissionHub = () => {
  const [overview, setOverview] = useState<CommissionHubOverview | null>(null);
  const [independent, setIndependent] = useState<IndependentAccount[]>([]);
  const [agentList, setAgentList] = useState<AgentListItem[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberCommission[]>([]);
  const [studentConfig, setStudentConfig] = useState<StudentReferralConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Use allSettled so one failing RPC doesn't kill the entire Hub.
      const [ovRes, indepRes, agentRes, studentRes, teamRes] = await Promise.all([
        db.rpc("get_commission_hub_overview"),
        db.rpc("get_independent_accounts"),
        db.rpc("get_agent_list"),
        db.rpc("get_student_referral_config"),
        db.rpc("get_team_members_commission"),
      ]);
      const firstError = [ovRes, indepRes, agentRes, studentRes, teamRes].find((r) => r?.error);
      if (firstError?.error) throw firstError.error;
      if (ovRes.data) setOverview(ovRes.data as CommissionHubOverview);
      if (indepRes.data) setIndependent((indepRes.data as IndependentAccount[]) ?? []);
      if (agentRes.data) setAgentList((agentRes.data as AgentListItem[]) ?? []);
      if (studentRes.data) setStudentConfig(studentRes.data as StudentReferralConfig);
      if (teamRes.data) setTeamMembers((teamRes.data as TeamMemberCommission[]) ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load commission data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const setCommission = useCallback(
    async (
      entity_type: string,
      entity_id: string | null,
      rate_kind: string,
      amount: number,
      reason?: string,
    ): Promise<void> => {
      setSaving(true);
      try {
        const { error } = await db.rpc("admin_set_commission", {
          p_entity_type: entity_type,
          p_entity_id: entity_id,
          p_rate_kind: rate_kind,
          p_amount: amount,
          p_reason: reason ?? null,
        });
        if (error) throw error;
        await fetchAll();
      } finally {
        setSaving(false);
      }
    },
    [fetchAll],
  );

  const fetchAgentNetwork = useCallback(async (agentId: string) => {
    const { data, error } = await db.rpc("get_agent_network_detail", { p_agent_id: agentId });
    if (error) throw error;
    return data;
  }, []);

  const fetchAccountHistory = useCallback(async (userId: string): Promise<AccountCommissionHistory> => {
    const { data, error } = await db.rpc("get_account_commission_history", { p_user_id: userId });
    if (error) throw error;
    return data as AccountCommissionHistory;
  }, []);

  return {
    overview,
    independent,
    agentList,
    teamMembers,
    studentConfig,
    loading,
    saving,
    error,
    setCommission,
    fetchAgentNetwork,
    fetchAccountHistory,
    refresh: fetchAll,
  };
};
