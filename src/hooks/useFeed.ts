
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface Post {
  id: string;
  author_id: string;
  title: string;
  content: string;
  post_type: 'announcement' | 'scholarship' | 'program' | 'success_story' | 'event' | 'deadline';
  tags: string[];
  is_pinned: boolean;
  is_verified: boolean;
  metadata: any;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string;
    avatar_url?: string;
  };
}

export const useFeed = (filters?: { post_type?: string; tags?: string[] }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['feed', filters],
    queryFn: async () => {
      let query = supabase
        .from('posts')
        .select(`
          *,
          profiles:author_id (
            full_name,
            avatar_url
          )
        `)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (filters?.post_type && ['announcement', 'scholarship', 'program', 'success_story', 'event', 'deadline'].includes(filters.post_type)) {
        query = query.eq('post_type', filters.post_type);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Post[];
    },
    enabled: !!user,
  });

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('posts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posts',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['feed'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return {
    posts,
    isLoading,
  };
};

// Mock data and functions for HomeFeed compatibility
export const useFeedData = (userId: string) => {
  const [isLoading, setIsLoading] = useState(false);
  
  return {
    recommendations: [],
    offers: [],
    recentViews: [],
    deadlines: [],
    communityHighlights: [],
    isLoading
  };
};

export const useRecommendationActions = () => {
  const handleSave = (itemId: string) => {
    console.log('Save item:', itemId);
  };

  return {
    handleSave
  };
};
