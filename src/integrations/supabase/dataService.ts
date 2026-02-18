/**
 * Centralized data service for all dashboard data fetching.
 * Uses safeQuery isolation so a single failed query never crashes the whole fetch.
 */
import { supabase } from './client';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
const safeQuery = async (p: any): Promise<{ data: any; error: any }> => {
  try {
    const result = await p;
    return { data: result.data ?? null, error: result.error ?? null };
  } catch (err: any) {
    // AbortError = request cancelled due to unmount or newer fetch — not a real error
    if (err?.name === 'AbortError') return { data: null, error: null };
    return { data: null, error: err };
  }
};

// ---------------------------------------------------------------------------
// Influencer Dashboard
// ---------------------------------------------------------------------------
export interface InfluencerDashboardData {
  leads: any[];
  cases: any[];
  profile: any | null;
}

export async function getInfluencerDashboard(
  userId: string
): Promise<{ data: InfluencerDashboardData | null; error: string | null }> {
  try {
    const [leadsRes, casesRes, profileRes] = await Promise.all([
      safeQuery(
        (supabase as any)
          .from('leads')
          .select('id, full_name, phone, eligibility_score, eligibility_reason, status, source_type, created_at, preferred_city, preferred_major, accommodation, ref_code, last_contacted')
          .eq('source_id', userId)
          .order('created_at', { ascending: false })
      ),
      safeQuery(
        (supabase as any)
          .from('student_cases')
          .select('*, leads!inner(source_id)')
          .eq('leads.source_id', userId)
      ),
      safeQuery(
        (supabase as any)
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle()
      ),
    ]);

    if (leadsRes.error) console.error('[dataService] Influencer leads fetch failed:', leadsRes.error);
    if (casesRes.error) console.error('[dataService] Influencer cases fetch failed:', casesRes.error);
    if (profileRes.error) console.error('[dataService] Influencer profile fetch failed:', profileRes.error);

    return {
      data: {
        leads: leadsRes.data ?? [],
        cases: casesRes.data ?? [],
        profile: profileRes.data ?? null,
      },
      error: null,
    };
  } catch (err: any) {
    console.error('[dataService] getInfluencerDashboard unexpected error:', err);
    return { data: null, error: err?.message ?? 'Failed to load influencer dashboard' };
  }
}

// ---------------------------------------------------------------------------
// Team Dashboard
// ---------------------------------------------------------------------------
export interface TeamDashboardData {
  cases: any[];
  leads: any[];
  appointments: any[];
  profile: any | null;
}

export async function getTeamDashboard(
  userId: string
): Promise<{ data: TeamDashboardData | null; error: string | null }> {
  try {
    const [casesRes, appointmentsRes, profileRes] = await Promise.all([
      safeQuery(
        (supabase as any)
          .from('student_cases')
          .select('*')
          .eq('assigned_lawyer_id', userId)
          .order('created_at', { ascending: false })
      ),
      safeQuery(
        (supabase as any)
          .from('appointments')
          .select('*')
          .eq('lawyer_id', userId)
          .order('scheduled_at', { ascending: true })
      ),
      safeQuery(
        (supabase as any)
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle()
      ),
    ]);

    if (casesRes.error) console.error('[dataService] Team cases fetch failed:', casesRes.error);
    if (appointmentsRes.error) console.error('[dataService] Team appointments fetch failed:', appointmentsRes.error);
    if (profileRes.error) console.error('[dataService] Team profile fetch failed:', profileRes.error);

    const casesData: any[] = casesRes.data ?? [];

    // Derive leads from the case lead_ids
    let leadsData: any[] = [];
    const leadIds = [...new Set(casesData.map((c: any) => c.lead_id).filter(Boolean))];
    if (leadIds.length > 0) {
      const leadsRes = await safeQuery(
        (supabase as any)
          .from('leads')
          .select('id, full_name, phone, email, eligibility_score, eligibility_reason, source_type, source_id, passport_type, english_units, math_units, last_contacted, created_at, preferred_major')
          .in('id', leadIds)
      );
      if (leadsRes.error) console.error('[dataService] Team leads fetch failed:', leadsRes.error);
      leadsData = leadsRes.data ?? [];
    }

    return {
      data: {
        cases: casesData,
        leads: leadsData,
        appointments: appointmentsRes.data ?? [],
        profile: profileRes.data ?? null,
      },
      error: null,
    };
  } catch (err: any) {
    console.error('[dataService] getTeamDashboard unexpected error:', err);
    return { data: null, error: err?.message ?? 'Failed to load team dashboard' };
  }
}

// ---------------------------------------------------------------------------
// Admin Dashboard
// ---------------------------------------------------------------------------
export interface AdminDashboardData {
  students: any[];
  services: any[];
  payments: any[];
  invites: any[];
  leads: any[];
  cases: any[];
  influencers: any[];
  lawyers: any[];
  commissions: any[];
  rewards: any[];
  auditLogs: any[];
  loginAttempts: any[];
  payoutRequests: any[];
}

export async function getAdminDashboard(): Promise<{
  data: AdminDashboardData | null;
  error: string | null;
}> {
  try {
    const [
      p, s, pay, inv, roles, leadsRes, casesRes,
      lawyerRoles, commissionsRes, rewardsRes, audit, logins, payoutReqRes,
    ] = await Promise.all([
      safeQuery((supabase as any).from('profiles').select('*').order('created_at', { ascending: false })),
      safeQuery((supabase as any).from('services').select('*').order('created_at', { ascending: false })),
      safeQuery((supabase as any).from('payments').select('*').order('created_at', { ascending: false })),
      safeQuery((supabase as any).from('influencer_invites').select('*').order('created_at', { ascending: false })),
      safeQuery((supabase as any).from('user_roles').select('*').eq('role', 'influencer')),
      safeQuery((supabase as any).from('leads').select('*').is('deleted_at', null).order('created_at', { ascending: false })),
      safeQuery((supabase as any).from('student_cases').select('*').is('deleted_at', null).order('created_at', { ascending: false })),
      safeQuery((supabase as any).from('user_roles').select('*').eq('role', 'lawyer')),
      safeQuery((supabase as any).from('commissions').select('*')),
      safeQuery((supabase as any).from('rewards').select('*')),
      safeQuery((supabase as any).from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(100)),
      safeQuery((supabase as any).from('login_attempts').select('*').order('created_at', { ascending: false }).limit(200)),
      safeQuery((supabase as any).from('payout_requests').select('*').order('requested_at', { ascending: false })),
    ]);

    if (p.error) console.error('[dataService] Admin profiles fetch failed:', p.error);
    if (s.error) console.error('[dataService] Admin services fetch failed:', s.error);
    if (leadsRes.error) console.error('[dataService] Admin leads fetch failed:', leadsRes.error);
    if (casesRes.error) console.error('[dataService] Admin cases fetch failed:', casesRes.error);
    if (commissionsRes.error) console.error('[dataService] Admin commissions fetch failed:', commissionsRes.error);
    if (rewardsRes.error) console.error('[dataService] Admin rewards fetch failed:', rewardsRes.error);

    // Resolve influencer profiles
    let influencers: any[] = [];
    if (roles.data) {
      const influencerIds = roles.data.map((r: any) => r.user_id);
      if (influencerIds.length > 0) {
        const infRes = await safeQuery(
          (supabase as any).from('profiles').select('*').in('id', influencerIds)
        );
        influencers = infRes.data ?? [];
      }
    }

    // Resolve lawyer profiles
    let lawyers: any[] = [];
    if (lawyerRoles.data) {
      const lawyerIds = lawyerRoles.data.map((r: any) => r.user_id);
      if (lawyerIds.length > 0) {
        const lawyerRes = await safeQuery(
          (supabase as any)
            .from('profiles')
            .select('id, full_name, email, commission_amount')
            .in('id', lawyerIds)
        );
        lawyers = lawyerRes.data ?? [];
      }
    }

    return {
      data: {
        students: p.data ?? [],
        services: s.data ?? [],
        payments: pay.data ?? [],
        invites: inv.data ?? [],
        leads: leadsRes.data ?? [],
        cases: casesRes.data ?? [],
        influencers,
        lawyers,
        commissions: commissionsRes.data ?? [],
        rewards: rewardsRes.data ?? [],
        auditLogs: audit.data ?? [],
        loginAttempts: logins.data ?? [],
        payoutRequests: payoutReqRes.data ?? [],
      },
      error: null,
    };
  } catch (err: any) {
    console.error('[dataService] getAdminDashboard unexpected error:', err);
    return { data: null, error: err?.message ?? 'Failed to load admin dashboard' };
  }
}
