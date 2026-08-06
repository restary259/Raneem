import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;

export const InvoiceService = {
  async listByCase(caseId: string): Promise<any[]> {
    const { data, error } = await db
      .from('invoices')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async listItems(invoiceIds: string[]): Promise<any[]> {
    if (invoiceIds.length === 0) return [];
    const { data, error } = await db
      .from('invoice_items')
      .select('*')
      .in('invoice_id', invoiceIds)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async listTotals(invoiceIds: string[]): Promise<any[]> {
    if (invoiceIds.length === 0) return [];
    const { data, error } = await db.from('invoice_totals').select('*').in('invoice_id', invoiceIds);
    if (error) throw error;
    return data ?? [];
  },

  async create(caseId: string, dueAt: string | null): Promise<any> {
    const { data, error } = await db
      .from('invoices')
      .insert({ case_id: caseId, due_at: dueAt })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async addItem(item: Record<string, unknown>): Promise<void> {
    const { error } = await db.from('invoice_items').insert(item);
    if (error) throw error;
  },

  async removeItem(itemId: string): Promise<void> {
    const { error } = await db.from('invoice_items').delete().eq('id', itemId);
    if (error) throw error;
  },

  async setStatus(invoiceId: string, status: 'draft' | 'sent' | 'paid' | 'void'): Promise<void> {
    const { error } = await db.from('invoices').update({ status }).eq('id', invoiceId);
    if (error) throw error;
  },

  async remove(invoiceId: string): Promise<void> {
    const { error } = await db.from('invoices').delete().eq('id', invoiceId);
    if (error) throw error;
  },
};
