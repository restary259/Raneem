
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Profile, 
  AcademicBackground, 
  TestScore, 
  StudentDocument, 
  StudentPreferences,
  ProfileCompletion 
} from '@/types/profile';

export const useStudentProfile = (userId: string) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [academicBackgrounds, setAcademicBackgrounds] = useState<AcademicBackground[]>([]);
  const [testScores, setTestScores] = useState<TestScore[]>([]);
  const [documents, setDocuments] = useState<StudentDocument[]>([]);
  const [preferences, setPreferences] = useState<StudentPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [completion, setCompletion] = useState<ProfileCompletion>({
    personal: 0,
    academic: 0,
    documents: 0,
    preferences: 0,
    overall: 0
  });
  const { toast } = useToast();

  // Fetch all profile data
  const fetchProfileData = async () => {
    if (!userId) return;
    
    setIsLoading(true);
    try {
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);

      // Fetch academic backgrounds
      const { data: academicData, error: academicError } = await supabase
        .from('academic_backgrounds')
        .select('*')
        .eq('user_id', userId)
        .order('graduation_year', { ascending: false });

      if (academicError && academicError.code !== 'PGRST116') throw academicError;
      setAcademicBackgrounds(academicData || []);

      // Fetch test scores
      const { data: testData, error: testError } = await supabase
        .from('test_scores')
        .select('*')
        .eq('user_id', userId)
        .order('date_taken', { ascending: false });

      if (testError && testError.code !== 'PGRST116') throw testError;
      setTestScores(testData || []);

      // Fetch documents
      const { data: documentsData, error: documentsError } = await supabase
        .from('student_documents')
        .select('*')
        .eq('user_id', userId)
        .order('uploaded_at', { ascending: false });

      if (documentsError && documentsError.code !== 'PGRST116') throw documentsError;
      setDocuments(documentsData || []);

      // Fetch preferences
      const { data: preferencesData, error: preferencesError } = await supabase
        .from('student_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (preferencesError && preferencesError.code !== 'PGRST116') throw preferencesError;
      setPreferences(preferencesData);

    } catch (error: any) {
      console.error('Error fetching profile data:', error);
      toast({
        variant: "destructive",
        title: "خطأ في تحميل البيانات",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate profile completion
  const calculateCompletion = () => {
    if (!profile) return;

    // Personal info completion (out of 10 fields)
    const personalFields = [
      profile.full_name,
      profile.first_name,
      profile.last_name,
      profile.email,
      profile.phone_number || profile.phone,
      profile.country,
      profile.city,
      profile.bio,
      profile.preferred_name,
      profile.pronouns
    ];
    const personalCompleted = personalFields.filter(field => field && field.trim()).length;
    const personalCompletion = Math.round((personalCompleted / personalFields.length) * 100);

    // Academic completion
    const academicCompletion = academicBackgrounds.length > 0 ? 
      Math.min(100, (academicBackgrounds.length * 50) + (testScores.length * 25)) : 0;

    // Documents completion
    const documentsCompletion = documents.length > 0 ? 
      Math.min(100, documents.length * 25) : 0;

    // Preferences completion
    const preferencesCompletion = preferences ? 
      Math.round(((preferences.interests?.length || 0 > 0 ? 1 : 0) +
                  (preferences.destinations?.length || 0 > 0 ? 1 : 0) +
                  (preferences.languages?.length || 0 > 0 ? 1 : 0) +
                  (preferences.notifications ? 1 : 0)) / 4 * 100) : 0;

    // Overall completion
    const overallCompletion = Math.round(
      (personalCompletion + academicCompletion + documentsCompletion + preferencesCompletion) / 4
    );

    setCompletion({
      personal: personalCompletion,
      academic: academicCompletion,
      documents: documentsCompletion,
      preferences: preferencesCompletion,
      overall: overallCompletion
    });
  };

  useEffect(() => {
    fetchProfileData();
  }, [userId]);

  useEffect(() => {
    calculateCompletion();
  }, [profile, academicBackgrounds, testScores, documents, preferences]);

  return {
    profile,
    academicBackgrounds,
    testScores,
    documents,
    preferences,
    completion,
    isLoading,
    refetch: fetchProfileData,
    setProfile,
    setAcademicBackgrounds,
    setTestScores,
    setDocuments,
    setPreferences
  };
};
