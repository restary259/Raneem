import { supabase } from '@/integrations/supabase/client';

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
      db.from('rewards').select('amount, status, admin_notes'),
      db
        .from('cases')
        .select('id, discount_amount, platform_revenue_ils, status')
        .eq('status', 'enrollment_paid'),
      // Global default commission rates (flat ILS amounts, not percentages).
      db.from('platform_settings').select('partner_commission_rate').maybeSingle(),
    ]);

    const submissions: any[] = subRes.data || [];
    const allRewards: any[] = allRewardsRes.data || [];
    const cases: any[] = casesRes.data || [];
    const partnerCommissionRate = Number(settingsRes.data?.partner_commission_rate ?? 0) || 0;

    const enrolledCount = cases.length;
    const referralDiscounts = cases.reduce((s, c) => s + (c.discount_amount || 0), 0);

    const partnerRewards = allRewards.filter((r) =>
      r.admin_notes?.startsWith('Partner commission from case')
    );
    const partnerCommissionPending = partnerRewards
      .filter((r) => r.status === 'pending' || r.status === 'approved')
      .reduce((s, r) => s + (r.amount || 0), 0);
    const partnerCommissionPaid = partnerRewards
      .filter((r) => r.status === 'paid')
      .reduce((s, r) => s + (r.amount || 0), 0);

    const teamCommissionsTotal = allRewards
      .filter((r) => r.admin_notes?.startsWith('Team commission from case'))
      .reduce((s, r) => s + (r.amount || 0), 0);
    const partnerCommissionsTotal = partnerRewards.reduce((s, r) => s + (r.amount || 0), 0);

    const serviceFeesFromSubs = submissions.reduce((s, r) => s + (r.service_fee || 0), 0);
    const serviceFeesFromCases =
      cases.reduce((s, c) => s + (c.platform_revenue_ils || 0), 0) +
      teamCommissionsTotal +
      partnerCommissionsTotal;

    const serviceFees = serviceFeesFromSubs > 0 ? serviceFeesFromSubs : serviceFeesFromCases;

    const platformNetRevenue = Math.max(
      0,
      serviceFees - teamCommissionsTotal - partnerCommissionsTotal
    );

    return {
      serviceFees,
      partnerCommissionPending,
      partnerCommissionPaid,
      platformNetRevenue,
      enrolledCount,
      referralDiscounts,
      partnerCommissionRate,
      submissions,
    };
  },
};
