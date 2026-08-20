import { supabase } from '@/integrations/supabase/client';
import { stripMustChangePassword } from '@/lib/profileWriteGuards';

const db = supabase as any;

export const StudentService = {
  async getProfile(userId: string): Promise<any | null> {
    const { data, error } = await db.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) throw error;
    return data;
  },

  async updateProfile(userId: string, patch: Record<string, unknown>): Promise<void> {
    const { error } = await db.from('profiles').update(stripMustChangePassword(patch)).eq('id', userId);
    if (error) throw error;
  },

  async listDocuments(caseId: string): Promise<any[]> {
    const { data, error } = await db
      .from('documents')
      .select('*')
      .eq('case_id', caseId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  async listChecklist(studentId: string): Promise<any[]> {
    const { data, error } = await db
      .from('student_checklist')
      .select('*, checklist_items(*)')
      .eq('student_id', studentId);
    if (error) throw error;
    return data ?? [];
  },
};
