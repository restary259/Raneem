import { supabase } from '@/integrations/supabase/client';
import { isTeam, isStudentReferral, isPartnerPool } from '@/lib/commissionClassifier';

const db = supabase as any;

export interface FinancialOverview {
  serviceFees: number;
  partnerCommissionPending: number;
  partnerCommissionPaid: number;
  platformNetRevenue: number;
  enrolledCount: number;
  referralDiscounts: number;
  /** Global default partner commission (flat ILS amount per student). */
  partnerCommissionRate: number;
  submissions: any[];
}

export const DashboardService = {
  /**
   * Admin financial overview. All amounts are ILS.
   * Service fees come from paid submissions; legacy cases fall back to
   * platform_revenue_ils plus recorded commissions.
   */
  async financialOverview(): Promise<FinancialOverview> {
    const [subRes, allRewardsRes, casesRes, settingsRes] = await Promise.all([
      db
        .from('case_submissions')
        .select('service_fee, enrollment_paid_at, case_id')
        .not('enrollment_paid_at', 'is', null),
      db.from('rewards').select('amount, status, admin_notes, case_id, reward_type'),
      db
        .from('cases')
        .select('id, referral_discount, platform_revenue_ils, status')
        .eq('status', 'enrollment_paid'),
      // Global default commission rates (flat ILS amounts, not percentages).
      db.from('platform_settings').select('partner_commission_rate').maybeSingle(),
    ]);

    const submissions: any[] = subRes.data || [];
    const allRewards: any[] = allRewardsRes.data || [];
    const cases: any[] = casesRes.data || [];
    const partnerCommissionRate = Number(settingsRes.data?.partner_commission_rate ?? 0) || 0;

    const enrolledCount = cases.length;
    const referralDiscounts = cases.reduce((s, c) => s + (c.referral_discount || 0), 0);

    // Classify by the structured reward_type column (authoritative); fall back
    // to admin_notes prefix only for legacy rows that predate reward_type.
    // The pure predicates live in commissionClassifier.ts (shared + tested).
    const partnerRewards = allRewards.filter(isPartnerPool);
    const partnerCommissionPending = partnerRewards
      .filter((r) => r.status === 'pending' || r.status === 'approved')
      .reduce((s, r) => s + (r.amount || 0), 0);
    const partnerCommissionPaid = partnerRewards
      .filter((r) => r.status === 'paid')
      .reduce((s, r) => s + (r.amount || 0), 0);

    const teamCommissionsTotal = allRewards.filter(isTeam).reduce((s, r) => s + (r.amount || 0), 0);
    const partnerCommissionsTotal = partnerRewards.reduce((s, r) => s + (r.amount || 0), 0);
    const studentReferralTotal = allRewards.filter(isStudentReferral).reduce((s, r) => s + (r.amount || 0), 0);

    const serviceFeesFromSubs = submissions.reduce((s, r) => s + (r.service_fee || 0), 0);
    const serviceFeesFromCases =
      cases.reduce((s, c) => s + (c.platform_revenue_ils || 0), 0) +
      teamCommissionsTotal +
      partnerCommissionsTotal +
      studentReferralTotal;

    const serviceFees = serviceFeesFromSubs > 0 ? serviceFeesFromSubs : serviceFeesFromCases;

    const platformNetRevenue = Math.max(
      0,
      serviceFees - teamCommissionsTotal - partnerCommissionsTotal - studentReferralTotal
    );

    // Per-case effective service fee: prefer the recorded service_fee, otherwise
    // reconstruct the real DARB total from platform revenue + commissions. This
    // mirrors the KPI-level serviceFeesFromCases logic but keyed per case_id, so
    // the recent-enrolled list renders the true amount for cases whose
    // case_submissions.service_fee was never populated.
    const teamCommByCase: Record<string, number> = {};
    const partnerCommByCase: Record<string, number> = {};
    for (const r of allRewards) {
      if (!r.case_id) continue;
      const amt = r.amount || 0;
      if (isTeam(r)) {
        teamCommByCase[r.case_id] = (teamCommByCase[r.case_id] || 0) + amt;
      } else if (isPartnerPool(r)) {
        partnerCommByCase[r.case_id] = (partnerCommByCase[r.case_id] || 0) + amt;
      }
    }
    const platformRevenueByCase: Record<string, number> = {};
    for (const c of cases) {
      platformRevenueByCase[c.id] = c.platform_revenue_ils || 0;
    }

    const enrichedSubmissions = submissions.map((s) => {
      const fallback =
        (platformRevenueByCase[s.case_id] || 0) +
        (teamCommByCase[s.case_id] || 0) +
        (partnerCommByCase[s.case_id] || 0);
      return {
        ...s,
        effective_service_fee: s.service_fee > 0 ? s.service_fee : fallback,
      };
    });

    return {
      serviceFees,
      partnerCommissionPending,
      partnerCommissionPaid,
      platformNetRevenue,
      enrolledCount,
      referralDiscounts,
      partnerCommissionRate,
      submissions: enrichedSubmissions,
    };
  },
};
