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
    await db.from('documents').delete().eq('case_id', caseId);
    await db.from('appointments').delete().eq('case_id', caseId);
    await db.from('case_submissions').delete().eq('case_id', caseId);
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
