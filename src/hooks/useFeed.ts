
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RecentView, Recommendation, Deadline, CommunityHighlight } from '@/types/feed';

export const useFeedData = (userId: string) => {
  // Mock recommendations - in real app this would be an edge function
  const { data: recommendations = [], isLoading: recsLoading } = useQuery({
    queryKey: ['recommendations', userId],
    queryFn: async (): Promise<Recommendation[]> => {
      // Mock data for now
      return [
        {
          id: '1',
          type: 'university',
          title: 'جامعة برلين التقنية - هندسة الحاسوب',
          description: 'برنامج ماجستير متميز في هندسة الحاسوب بألمانيا',
          partner_name: 'جامعة برلين التقنية',
          score: 95,
          tags: ['هندسة', 'ألمانيا', 'تقنية'],
          image_url: '/placeholder.svg'
        },
        {
          id: '2',
          type: 'scholarship',
          title: 'منحة DAAD للطلاب العرب',
          description: 'منحة دراسية شاملة للدراسة في ألمانيا',
          partner_name: 'DAAD',
          score: 88,
          tags: ['منحة', 'ألمانيا', 'دراسات عليا'],
          image_url: '/placeholder.svg'
        }
      ];
    },
    enabled: !!userId,
  });

  // Recent offers and announcements
  const { data: offers = [], isLoading: offersLoading } = useQuery({
    queryKey: ['feed-offers', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .in('type', ['offer', 'system'])
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  // Recently viewed items - now querying the actual views table
  const { data: recentViews = [], isLoading: viewsLoading } = useQuery({
    queryKey: ['recent-views', userId],
    queryFn: async (): Promise<RecentView[]> => {
      const { data, error } = await supabase
        .from('views')
        .select('*')
        .eq('user_id', userId)
        .order('viewed_at', { ascending: false })
        .limit(8);

      if (error) throw error;
      
      // Transform data to match RecentView type
      return (data || []).map(item => ({
        id: item.id,
        user_id: item.user_id || '',
        item_type: ['university', 'program', 'partner', 'offer'].includes(item.item_type) 
          ? item.item_type as 'university' | 'program' | 'partner' | 'offer'
          : 'university' as const,
        item_id: item.item_id,
        viewed_at: item.viewed_at || new Date().toISOString(),
        item_data: item.item_data && typeof item.item_data === 'object' && item.item_data !== null
          ? {
              title: (item.item_data as any)?.title || 'عنصر محفوظ',
              image_url: (item.item_data as any)?.image_url || undefined,
              description: (item.item_data as any)?.description || undefined,
            }
          : {
              title: 'عنصر محفوظ',
              image_url: undefined,
              description: undefined,
            }
      }));
    },
    enabled: !!userId,
  });

  // Upcoming deadlines - mock for now
  const { data: deadlines = [], isLoading: deadlinesLoading } = useQuery({
    queryKey: ['upcoming-deadlines', userId],
    queryFn: async (): Promise<Deadline[]> => {
      // Mock data - in real app this would query applications table
      return [
        {
          id: '1',
          title: 'موعد نهائي لتقديم الوثائق - جامعة ميونخ',
          deadline_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
          urgency: 'high',
          type: 'document'
        },
        {
          id: '2',
          title: 'موعد المقابلة - منحة DAAD',
          deadline_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          urgency: 'medium',
          type: 'interview'
        }
      ];
    },
    enabled: !!userId,
  });

  // Community highlights - mock for now
  const { data: communityHighlights = [], isLoading: communityLoading } = useQuery({
    queryKey: ['community-highlights'],
    queryFn: async (): Promise<CommunityHighlight[]> => {
      // Mock data
      return [
        {
          id: '1',
          type: 'webinar',
          title: 'ندوة: كيفية التقديم للجامعات الألمانية',
          description: 'ندوة مجانية تشرح خطوات التقديم والوثائق المطلوبة',
          participant_count: 156,
          date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          url: '/webinars/1'
        },
        {
          id: '2',
          type: 'forum',
          title: 'مناقشة: تجارب الطلاب في رومانيا',
          description: 'شارك تجربتك أو اطرح أسئلتك حول الدراسة في رومانيا',
          participant_count: 43,
          url: '/forum/2'
        }
      ];
    },
  });

  return {
    recommendations,
    offers,
    recentViews,
    deadlines,
    communityHighlights,
    isLoading: recsLoading || offersLoading || viewsLoading || deadlinesLoading || communityLoading,
  };
};

export const useRecommendationActions = () => {
  const handleSave = async (recommendationId: string) => {
    // Implement save functionality
    console.log('Saving recommendation:', recommendationId);
  };

  const handleView = async (recommendationId: string) => {
    // Track view and navigate
    console.log('Viewing recommendation:', recommendationId);
  };

  return {
    handleSave,
    handleView,
  };
};

// Hook to track viewed items
export const useTrackView = () => {
  const trackView = async (itemType: string, itemId: string, itemData?: any) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('views')
      .insert({
        user_id: user.id,
        item_type: itemType,
        item_id: itemId,
        item_data: itemData
      });
  };

  return { trackView };
};
