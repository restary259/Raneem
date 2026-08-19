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
  recruited_partners: number;
  recruited_ambassadors: number;
  direct_partners: number;
  direct_ambassadors: number;
  global_rates: {
    partner: number;
    ambassador: number;
    team: number;
    agent: number;
    agent_self_referral: number;
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
  self_referral_override: number | null;
  self_referral_global: number;
  status: "active" | "inactive";
  students_referred: number;
  earned: number;
}

export interface TeamMemberCommission {
  id: string;
  name: string;
  email: string;
  override: number | null;
  is_manager: boolean;
  global_rate: number;
}

/** Shared row shape for the Partners / Ambassadors tabs. */
export interface PartnerListItem {
  id: string;
  name: string;
  email: string;
  override: number | null;
  global_rate: number;
  agent_id: string | null;
  agent_name: string | null;
  students_referred: number;
  earned: number;
}

/** Result of get_commission_simulation_inputs — rates resolved server-side by
 * the same production resolver functions the commission engine calls. */
export interface SimulationInputs {
  globals: CommissionHubOverview["global_rates"];
  person: {
    id: string;
    name: string | null;
    email: string | null;
    role: string | null;
    agent_id: string | null;
    agent_name: string | null;
    is_recruited: boolean;
    effective: {
      partner?: number;
      team?: number;
      agent?: number;
      agent_self_referral?: number;
      student_friend_reward?: number;
      student_family_reward?: number;
    };
    recruiter: {
      id: string;
      name: string | null;
      agent_effective: number;
    } | null;
  } | null;
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
  const [partnerList, setPartnerList] = useState<PartnerListItem[]>([]);
  const [ambassadorList, setAmbassadorList] = useState<PartnerListItem[]>([]);
  const [studentConfig, setStudentConfig] = useState<StudentReferralConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!initialized) setLoading(true);
    setError(null);
    try {
      const [ovRes, indepRes, agentRes, studentRes, teamRes, partnerRes, ambassadorRes] = await Promise.all([
        db.rpc("get_commission_hub_overview"),
        db.rpc("get_independent_accounts"),
        db.rpc("get_agent_list"),
        db.rpc("get_student_referral_config"),
        db.rpc("get_team_members_commission"),
        db.rpc("get_partner_list"),
        db.rpc("get_ambassador_list"),
      ]);
      const firstError = [ovRes, indepRes, agentRes, studentRes, teamRes, partnerRes, ambassadorRes].find((r) => r?.error);
      if (firstError?.error) throw firstError.error;
      if (ovRes.data) setOverview(ovRes.data as CommissionHubOverview);
      if (indepRes.data) setIndependent((indepRes.data as IndependentAccount[]) ?? []);
      if (agentRes.data) setAgentList((agentRes.data as AgentListItem[]) ?? []);
      if (studentRes.data) setStudentConfig(studentRes.data as StudentReferralConfig);
      if (teamRes.data) setTeamMembers((teamRes.data as TeamMemberCommission[]) ?? []);
      if (partnerRes.data) setPartnerList((partnerRes.data as PartnerListItem[]) ?? []);
      if (ambassadorRes.data) setAmbassadorList((ambassadorRes.data as PartnerListItem[]) ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load commission data");
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, [initialized]);

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

  /** Simulator inputs — lazy, NOT part of fetchAll (fetched by the Simulator
   * tab on mount / person change / hub refresh). */
  const fetchSimulationInputs = useCallback(async (userId?: string): Promise<SimulationInputs> => {
    const { data, error } = await db.rpc("get_commission_simulation_inputs", {
      p_user_id: userId ?? null,
    });
    if (error) throw error;
    return data as SimulationInputs;
  }, []);

  return {
    overview,
    independent,
    agentList,
    teamMembers,
    partnerList,
    ambassadorList,
    studentConfig,
    loading,
    saving,
    error,
    setCommission,
    fetchAgentNetwork,
    fetchAccountHistory,
    fetchSimulationInputs,
    refresh: fetchAll,
  };
};
