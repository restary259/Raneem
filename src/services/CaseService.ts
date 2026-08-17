import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;

/** Throws the Supabase error when present, otherwise returns the rows. */
function unwrap<T>(res: { data: T | null; error: any }): T {
  if (res.error) throw res.error;
  return (res.data ?? []) as T;
}

export interface TeamMemberSummary {
  id: string;
  full_name: string;
  email: string;
}

/** Display attribution for a partner/agent id: resolved name + primary role. */
export interface AttributionInfo {
  name: string;
  role: string | null;
}

/**
 * Role precedence when a user holds several roles. The first match here wins;
 * admin/team_member are fallbacks so a staff-created case still resolves.
 */
const ATTRIBUTION_ROLE_PRIORITY = [
  'agent',
  'social_media_partner',
  'ambassador',
  'admin',
  'team_member',
] as const;

export const CaseService = {
  /** Active board cases (archived and terminal-noise statuses excluded). */
  async listActive(): Promise<any[]> {
    return unwrap(
      await db
        .from('cases')
        .select('*')
        .eq('archived', false)
        .not('status', 'in', '("forgotten","cancelled")')
    );
  },

  async getById(caseId: string): Promise<any | null> {
    const { data, error } = await db.from('cases').select('*').eq('id', caseId).single();
    if (error) throw error;
    return data;
  },

  async listTeamMembers(): Promise<TeamMemberSummary[]> {
    const roles = unwrap<{ user_id: string }[]>(
      await db.from('user_roles').select('user_id').eq('role', 'team_member')
    );
    const ids = roles.map((r) => r.user_id);
    if (ids.length === 0) return [];
    const profiles = unwrap<{ id: string; full_name: string; email: string | null }[]>(
      await db.from('profiles').select('id, full_name, email').in('id', ids)
    );
    return profiles.map((p) => ({ id: p.id, full_name: p.full_name, email: p.email || '' }));
  },

  /**
   * Resolve display attribution (name + primary role) for a set of partner/agent
   * ids. Names come from the SECURITY DEFINER `resolve_profile_names` RPC: there
   * is NO foreign key from cases.partner_id → profiles, and team RLS on profiles
   * would silently drop partner rows on a direct select, so the RPC is the only
   * reliable resolver. Roles come from a direct user_roles read (admin-visible).
   * A user may hold several roles; the first per ATTRIBUTION_ROLE_PRIORITY wins.
   */
  async resolveAttribution(ids: (string | null | undefined)[]): Promise<Record<string, AttributionInfo>> {
    const unique = Array.from(new Set((ids.filter(Boolean) as string[])));
    if (unique.length === 0) return {};
    const [nameRes, roleRes] = await Promise.all([
      db.rpc('resolve_profile_names', { p_ids: unique }),
      db.from('user_roles').select('user_id, role').in('user_id', unique),
    ]);
    if (nameRes.error) throw nameRes.error;
    if (roleRes.error) throw roleRes.error;
    const out: Record<string, AttributionInfo> = {};
    for (const id of unique) out[id] = { name: '—', role: null };
    (nameRes.data ?? []).forEach((p: any) => {
      if (out[p.id]) out[p.id].name = p.full_name ?? '—';
    });
    (roleRes.data ?? []).forEach((r: any) => {
      const cur = out[r.user_id];
      if (!cur) return;
      const pri = (ATTRIBUTION_ROLE_PRIORITY as readonly string[]).indexOf(r.role);
      if (pri !== -1) {
        const curPri = cur.role == null ? Infinity : (ATTRIBUTION_ROLE_PRIORITY as readonly string[]).indexOf(cur.role);
        if (pri < curPri) cur.role = r.role;
      } else if (cur.role == null) {
        cur.role = r.role;
      }
    });
    return out;
  },

  async assign(caseId: string, userId: string | null): Promise<void> {
    const { error } = await db.from('cases').update({ assigned_to: userId || null }).eq('id', caseId);
    if (error) throw error;
  },

  async update(caseId: string, patch: Record<string, unknown>): Promise<void> {
    const { error } = await db.from('cases').update(patch).eq('id', caseId);
    if (error) throw error;
  },

  async updateStatus(caseId: string, status: string): Promise<void> {
    const { error } = await db.from('cases').update({ status }).eq('id', caseId);
    if (error) throw error;
  },

  async setArchived(caseId: string, archived: boolean): Promise<void> {
    const { error } = await db.from('cases').update({ archived }).eq('id', caseId);
    if (error) throw error;
  },

  /** Hard delete plus the child rows that have no cascade. Admin-only via RLS. */
  async remove(caseId: string): Promise<void> {
    // A failed child delete makes the parent delete fail on the FK anyway, so
    // report the real cause instead of the downstream constraint violation.
    for (const table of ['documents', 'appointments', 'case_submissions']) {
      const { error } = await db.from(table).delete().eq('case_id', caseId);
      if (error) throw error;
    }
    const { error } = await db.from('cases').delete().eq('id', caseId);
    if (error) throw error;
  },

  async listEvents(caseId: string): Promise<any[]> {
    return unwrap(
      await db
        .from('case_events')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at', { ascending: false })
    );
  },
};
