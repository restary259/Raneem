
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
      // Since the table doesn't exist yet, return empty array for now
      console.log('Saved programs feature will be available after database migration');
      setSavedPrograms([]);
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
      console.log('Save program will be available after database migration');
      return false;
    } catch (error) {
      console.error('Error saving program:', error);
      return false;
    }
  };

  const removeProgram = async (programId: string) => {
    if (!user) return false;

    try {
      console.log('Remove program will be available after database migration');
      return false;
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
