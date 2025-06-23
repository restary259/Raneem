
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface SavedProgram {
  id: string;
  program_data: any;
  saved_at: string;
}

export const useSavedPrograms = () => {
  const { user } = useAuth();
  const [savedPrograms, setSavedPrograms] = useState<SavedProgram[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSavedPrograms = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('saved_programs' as any)
        .select('*')
        .eq('user_id', user.id)
        .order('saved_at', { ascending: false });

      if (error) {
        console.error('Error fetching saved programs:', error);
        setSavedPrograms([]);
        return;
      }
      
      setSavedPrograms(data || []);
    } catch (error) {
      console.error('Error fetching saved programs:', error);
      setSavedPrograms([]);
    } finally {
      setLoading(false);
    }
  };

  const saveProgram = async (programData: any) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('saved_programs' as any)
        .insert({
          user_id: user.id,
          program_data: programData
        });

      if (error) {
        console.error('Error saving program:', error);
        return false;
      }
      
      await fetchSavedPrograms();
      return true;
    } catch (error) {
      console.error('Error saving program:', error);
      return false;
    }
  };

  const removeProgram = async (programId: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('saved_programs' as any)
        .delete()
        .eq('id', programId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error removing program:', error);
        return false;
      }
      
      await fetchSavedPrograms();
      return true;
    } catch (error) {
      console.error('Error removing program:', error);
      return false;
    }
  };

  useEffect(() => {
    fetchSavedPrograms();
  }, [user]);

  return {
    savedPrograms,
    loading,
    saveProgram,
    removeProgram,
    refetch: fetchSavedPrograms
  };
};
