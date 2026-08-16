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
  /** Team-member commissions actually PAID OUT (cash-out view, status='paid'). */
  teamCommissionsTotal: number;
  submissions: any[];
}

export const DashboardService = {
  /**
   * Admin financial overview. All amounts are ILS.
   *
   * Service fees are computed PER enrolled case: a confirmed agency-service
   * payment is authoritative; a legacy case without a payment row falls back to
   * platform_revenue_ils + recorded commissions for that case (reconstructs the
   * historical gross). Both contribute, so a mix of paid + legacy enrolled cases
   * no longer zeroes the legacy half (the old all-or-nothing switch did).
   *
   * KPI accounting (per the operator's decision) is the CASH-OUT view:
   *   - Team Commissions / Platform Net Revenue count only PAID rewards.
   *   - Partner Pending keeps pending + approved together.
   * A case "finishes" at enrollment_paid (the only terminal success status).
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
        .select('id, referral_discount, platform_revenue_ils, status, created_at')
        .eq('status', 'enrollment_paid')
        .eq('archived', false)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
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

    // PAID-only totals (cash-out view).
    const teamCommissionsPaid = allRewards
      .filter((r) => isTeam(r) && r.status === 'paid')
      .reduce((s, r) => s + (r.amount || 0), 0);
    const studentReferralPaid = allRewards
      .filter((r) => isStudentReferral(r) && r.status === 'paid')
      .reduce((s, r) => s + (r.amount || 0), 0);

    // All-status per-case commission maps, used to reconstruct the historical
    // GROSS service fee for legacy cases without a payment row. These are
    // intentionally NOT the paid-only totals — using those here would understate
    // legacy service fees (a pending/approved commission is still part of the
    // gross the case earned). Student-referral rewards are deliberately excluded
    // from the gross: they are paid from Darb's margin, not part of the case fee.
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

    // Per-case confirmed payment: authoritative service fee when present.
    const paymentByCase: Record<string, { amount: number; confirmedAt: string | null }> = {};
    for (const p of payments) {
      const cid = p.case_id;
      if (!cid) continue;
      const prev = paymentByCase[cid];
      const amt = p.amount || 0;
      if (!prev) {
        paymentByCase[cid] = { amount: amt, confirmedAt: p.confirmed_at ?? null };
      } else {
        prev.amount += amt;
        // Keep the earliest confirmed date as the enrollment anchor.
        if (p.confirmed_at && (!prev.confirmedAt || p.confirmed_at < prev.confirmedAt)) {
          prev.confirmedAt = p.confirmed_at;
        }
      }
    }

    // Service-fee aggregate = sum over EVERY enrolled case of its per-case fee
    // (confirmed payment if any, else the platform-revenue + commission
    // reconstruction). This reconciles exactly with the recent-enrolled list,
    // which is now built from the same per-case computation.
    const enrichedSubmissions = cases.map((c) => {
      const pay = paymentByCase[c.id];
      const fallback =
        (platformRevenueByCase[c.id] || 0) +
        (teamCommByCase[c.id] || 0) +
        (partnerCommByCase[c.id] || 0);
      const effectiveServiceFee = pay && pay.amount > 0 ? pay.amount : fallback;
      return {
        case_id: c.id,
        enrollment_paid_at: pay?.confirmedAt ?? c.created_at ?? null,
        effective_service_fee: effectiveServiceFee,
      };
    });

    const serviceFees = enrichedSubmissions.reduce((s, e) => s + e.effective_service_fee, 0);

    // Net revenue = service fees − commissions actually PAID OUT (cash-out view).
    const platformNetRevenue = Math.max(
      0,
      serviceFees - teamCommissionsPaid - partnerCommissionPaid - studentReferralPaid
    );

    return {
      serviceFees,
      partnerCommissionPending,
      partnerCommissionPaid,
      platformNetRevenue,
      enrolledCount,
      referralDiscounts,
      partnerCommissionRate,
      teamCommissionsTotal: teamCommissionsPaid,
      submissions: enrichedSubmissions,
    };
  },
};
