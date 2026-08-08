import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;

export const PaymentService = {
  async listByStudent(studentId: string): Promise<any[]> {
    const { data, error } = await db
      .from('payments')
      .select('*')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },




  async record(payment: Record<string, unknown>): Promise<void> {
    const { error } = await db.from('payments').insert(payment);
    if (error) throw error;
  },

  async listPayoutRequests(): Promise<any[]> {
    const { data, error } = await db
      .from('payout_requests')
      .select('*')
      .order('requested_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
};
