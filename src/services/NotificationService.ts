import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;

export const NotificationService = {
  async listForUser(userId: string, limit = 50): Promise<any[]> {
    const { data, error } = await db
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  },

  async markRead(notificationId: string): Promise<void> {
    const { error } = await db
      .from('notifications')
      .update({ is_read: true, read: true })
      .eq('id', notificationId);
    if (error) throw error;
  },

  async markAllRead(userId: string): Promise<void> {
    const { error } = await db
      .from('notifications')
      .update({ is_read: true, read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    if (error) throw error;
  },
};
