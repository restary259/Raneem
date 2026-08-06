import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;

export const PartnerService = {
  async listLinks(partnerId: string): Promise<any[]> {
    const { data, error } = await db
      .from('partner_links')
      .select('id, code, label, target_path, active, created_at')
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async createLink(partnerId: string, code: string, label: string, targetPath = '/apply'): Promise<void> {
    const { error } = await db
      .from('partner_links')
      .insert({ partner_id: partnerId, code, label, target_path: targetPath });
    if (error) throw error;
  },

  async setLinkActive(linkId: string, active: boolean): Promise<void> {
    const { error } = await db.from('partner_links').update({ active }).eq('id', linkId);
    if (error) throw error;
  },

  /** Click counts keyed by partner_link_id. */
  async clickCounts(linkIds: string[]): Promise<Record<string, number>> {
    if (linkIds.length === 0) return {};
    const { data, error } = await db
      .from('partner_clicks')
      .select('partner_link_id')
      .in('partner_link_id', linkIds);
    if (error) throw error;
    const tally: Record<string, number> = {};
    (data ?? []).forEach((row: any) => {
      tally[row.partner_link_id] = (tally[row.partner_link_id] ?? 0) + 1;
    });
    return tally;
  },

  async listRewards(partnerId: string): Promise<any[]> {
    const { data, error } = await db
      .from('rewards')
      .select('*')
      .eq('user_id', partnerId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
};
