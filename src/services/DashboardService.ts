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
  /** Total team-member commissions (flat ILS, all statuses). */
  teamCommissionsTotal: number;
  submissions: any[];
}

export const DashboardService = {
  /**
   * Admin financial overview. All amounts are ILS.
   * Service fees come from confirmed agency-service payments in case_payments
   * (the authoritative source, matching get_monthly_tax_report). Legacy cases
   * that predate the finance workflow fall back to platform_revenue_ils plus
   * recorded commissions.
   */
  async financialOverview(): Promise<FinancialOverview> {
    const [payRes, allRewardsRes, casesRes, settingsRes] = await Promise.all([
      db
        .from('case_payments')
        .select('amount, case_id, confirmed_at')
        .eq('payment_type', 'agency_service')
        .eq('status', 'confirmed')
        .not('confirmed_at', 'is', null),
      db.from('rewards').select('amount, status, admin_notes, case_id, reward_type'),
      db
        .from('cases')
        .select('id, referral_discount, platform_revenue_ils, status')
        .eq('status', 'enrollment_paid'),
      // Global default commission rates (flat ILS amounts, not percentages).
      db.from('platform_settings').select('partner_commission_rate').maybeSingle(),
    ]);

    const payments: any[] = payRes.data || [];
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

    // Authoritative: confirmed agency-service payments from case_payments.
    const serviceFeesFromPayments = payments.reduce((s, p) => s + (p.amount || 0), 0);

    // Legacy fallback: reconstruct gross from platform revenue + commissions
    // for deployments that predate the case_payments finance flow.
    const serviceFeesFromCases =
      cases.reduce((s, c) => s + (c.platform_revenue_ils || 0), 0) +
      teamCommissionsTotal +
      partnerCommissionsTotal +
      studentReferralTotal;

    const serviceFees = serviceFeesFromPayments > 0 ? serviceFeesFromPayments : serviceFeesFromCases;

    const platformNetRevenue = Math.max(
      0,
      serviceFees - teamCommissionsTotal - partnerCommissionsTotal - studentReferralTotal
    );

    // Per-case effective service fee for the recent-enrolled list. Each
    // confirmed payment is authoritative; legacy cases without a payment row
    // fall back to platform revenue + commissions for that case.
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

    const enrichedSubmissions = payments.map((p) => {
      const fallback =
        (platformRevenueByCase[p.case_id] || 0) +
        (teamCommByCase[p.case_id] || 0) +
        (partnerCommByCase[p.case_id] || 0);
      return {
        ...p,
        // case_payments.amount is the authoritative fee; fall back to the
        // reconstruction only if the payment row has no amount (shouldn't happen).
        service_fee: p.amount,
        enrollment_paid_at: p.confirmed_at,
        effective_service_fee: p.amount > 0 ? p.amount : fallback,
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
      teamCommissionsTotal,
      submissions: enrichedSubmissions,
    };
  },
};
