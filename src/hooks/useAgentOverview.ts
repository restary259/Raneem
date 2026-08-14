import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthedUserId } from "@/hooks/useAuthedUserId";
import { useEarningsSummary, type EarningsSummary } from "@/hooks/useEarningsSummary";

/** A recruit (partner or ambassador) in the agent's network. */
export interface AgentRecruit {
  partner_id: string;
  full_name: string;
  email: string;
  city: string | null;
  referral_code: string | null;
  joined_at: string;
  status: string;
  students_count: number;
  paid_cases: number;
  override_earned: number;
  agent_amount?: number;
  role?: string;
}

export interface AgentSelfReferralRate {
  /** Global default self-referral rate from platform_settings. */
  global: number;
  /** Per-agent override if one exists. */
  override: number | null;
  /** Effective rate (override ?? global). */
  effective: number;
}

export interface AgentCommissionRates {
  /** Network per-recruit override (agent_commission_rate / per-agent override). */
  perRecruit: number;
  /** Agent's own self-referral reward rate. */
  selfReferral: AgentSelfReferralRate;
  /** The partner pool amount (informational). */
  pool: number;
}

export interface AgentProfile {
  full_name: string | null;
  email: string | null;
  agent_can_invite_directly: boolean;
  recruit_code: string | null;
  referral_code: string | null;
}

export interface AgentStats {
  totalPartners: number;
  totalAmbassadors: number;
  activeRecruits: number;
  networkStudents: number;
  paidCases: number;
  overrideEarned: number;
  /** Students the agent referred personally (their own apply link). */
  directStudents: number;
  /** Students referred by partners in the network. */
  partnerStudents: number;
  /** Students referred by ambassadors in the network. */
  ambassadorStudents: number;
  /** Every distinct case attributable to the agent (network + direct). */
  totalStudents: number;
  newCases: number;
  submittedCases: number;
  enrolledCases: number;
  casesLast30d: number;
  /** enrolled / total students, 0–100. */
  conversionRate: number;
  commissionNetwork: number;
  commissionSelf: number;
}

export interface AgentOverviewData {
  profile: AgentProfile | null;
  recruits: AgentRecruit[];
  stats: AgentStats;
  rates: AgentCommissionRates;
  earnings: EarningsSummary;
  loading: boolean;
  refetch: () => void;
}


const fmt0 = (n: unknown) => Number(n || 0);

/**
 * Single hook that loads everything the agent dashboard pages need:
 * profile + recruit link, the network list, commission rates (network +
 * self-referral), and the earnings summary. Pages consume slices of this
 * rather than each re-fetching independently.
 */
export function useAgentOverview(): AgentOverviewData {
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [recruits, setRecruits] = useState<AgentRecruit[]>([]);
  const [rates, setRates] = useState<AgentCommissionRates>({
    perRecruit: 0,
    selfReferral: { global: 1000, override: null, effective: 1000 },
    pool: 1000,
  });
  const [loading, setLoading] = useState(true);
  const { summary: earnings } = useEarningsSummary(true);

  const load = useCallback(async (uid: string) => {
    const [profRes, netRes, linkRes, settingsRes, overrideRes, selfRefRes] = await Promise.all([
      (supabase as any)
        .from("profiles")
        .select("full_name, email, agent_can_invite_directly, referral_code")
        .eq("id", uid)
        .maybeSingle(),
      (supabase as any).rpc("get_my_agent_network"),
      (supabase as any).rpc("ensure_agent_recruit_link"),
      (supabase as any)
        .from("platform_settings")
        .select("agent_commission_rate, partner_commission_rate, agent_self_referral_rate")
        .limit(1)
        .maybeSingle(),
      (supabase as any)
        .from("agent_commission_overrides")
        .select("commission_amount")
        .eq("agent_id", uid)
        .maybeSingle(),
      (supabase as any)
        .from("agent_self_referral_overrides")
        .select("commission_amount")
        .eq("agent_id", uid)
        .maybeSingle(),
    ]);

    const prof = profRes.data;
    const linkRow = Array.isArray(linkRes.data) ? linkRes.data[0] : linkRes.data;
    setProfile({
      full_name: prof?.full_name ?? null,
      email: prof?.email ?? null,
      agent_can_invite_directly: prof?.agent_can_invite_directly ?? false,
      recruit_code: linkRow?.code ?? null,
      referral_code: prof?.referral_code ?? null,
    });

    setRecruits((netRes.data ?? []) as AgentRecruit[]);

    const globalPerRecruit = Number(settingsRes.data?.agent_commission_rate ?? 0);
    const perRecruit = Number(overrideRes.data?.commission_amount ?? globalPerRecruit);
    const pool = Number(settingsRes.data?.partner_commission_rate ?? 1000);
    const selfGlobal = Number(settingsRes.data?.agent_self_referral_rate ?? 1000);
    const selfOverride = selfRefRes.data?.commission_amount ?? null;
    setRates({
      perRecruit,
      pool,
      selfReferral: {
        global: selfGlobal,
        override: selfOverride != null ? Number(selfOverride) : null,
        effective: selfOverride != null ? Number(selfOverride) : selfGlobal,
      },
    });

    setLoading(false);
  }, []);

  const userId = useAuthedUserId(load);

  const refetch = useCallback(() => {
    if (userId) {
      setLoading(true);
      load(userId);
    }
  }, [userId, load]);

  // Derive stats from the recruit list (single source of truth).
  const stats: AgentStats = {
    totalPartners: recruits.filter((r) => !r.role || r.role === "social_media_partner").length,
    totalAmbassadors: recruits.filter((r) => r.role === "ambassador").length,
    activeRecruits: recruits.filter((r) => r.status === "active").length,
    networkStudents: recruits.reduce((s, r) => s + fmt0(r.students_count), 0),
    paidCases: recruits.reduce((s, r) => s + fmt0(r.paid_cases), 0),
    overrideEarned: recruits.reduce((s, r) => s + fmt0(r.override_earned), 0),
  };

  return { profile, recruits, stats, rates, earnings, loading, refetch };
}
