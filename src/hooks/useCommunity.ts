
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ForumCategory, ForumTopic, ForumPost, CommunityEvent, StudyGroup } from '@/types/community';

// Forum Categories Hook
export const useForumCategories = () => {
  return useQuery({
    queryKey: ['forum-categories'],
    queryFn: async (): Promise<ForumCategory[]> => {
      const { data, error } = await supabase
        .from('forum_categories')
        .select('*')
        .order('name');

      if (error) throw error;
      return data || [];
    },
  });
};

// Forum Topics Hook
export const useForumTopics = (categoryId?: string, searchQuery?: string) => {
  return useQuery({
    queryKey: ['forum-topics', categoryId, searchQuery],
    queryFn: async (): Promise<ForumTopic[]> => {
      let query = supabase
        .from('forum_topics')
        .select(`
          *,
          author:profiles(id, full_name, avatar_url),
          category:forum_categories(id, name, description, created_at)
        `)
        .order('is_pinned', { ascending: false })
        .order('updated_at', { ascending: false });

      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }

      if (searchQuery) {
        query = query.ilike('title', `%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Transform the data to match our types
      return (data || []).map((item: any) => ({
        ...item,
        category: item.category ? {
          id: item.category.id,
          name: item.category.name,
          description: item.category.description || undefined,
          created_at: item.category.created_at || new Date().toISOString()
        } : undefined
      }));
    },
  });
};

// Forum Posts Hook
export const useForumPosts = (topicId: string) => {
  return useQuery({
    queryKey: ['forum-posts', topicId],
    queryFn: async (): Promise<ForumPost[]> => {
      const { data, error } = await supabase
        .from('forum_posts')
        .select(`
          *,
          author:profiles(id, full_name, avatar_url)
        `)
        .eq('topic_id', topicId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });
};

// Community Events Hook
export const useCommunityEvents = (upcomingOnly: boolean = true) => {
  return useQuery({
    queryKey: ['community-events', upcomingOnly],
    queryFn: async (): Promise<CommunityEvent[]> => {
      let query = supabase
        .from('community_events')
        .select('*');

      if (upcomingOnly) {
        query = query.gte('start_time', new Date().toISOString());
      }

      query = query.order('start_time', { ascending: true });

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
};

// Study Groups Hook
export const useStudyGroups = (userId?: string) => {
  return useQuery({
    queryKey: ['study-groups', userId],
    queryFn: async (): Promise<StudyGroup[]> => {
      const { data, error } = await supabase
        .from('study_groups')
        .select(`
          *,
          owner:profiles(id, full_name, avatar_url),
          user_membership:group_memberships!inner(role, joined_at)
        `)
        .eq('group_memberships.user_id', userId || '')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      
      // Transform the data to match our types
      return (data || []).map((item: any) => ({
        ...item,
        user_membership: item.user_membership && item.user_membership.length > 0 ? {
          role: ['member', 'moderator', 'owner'].includes(item.user_membership[0].role) 
            ? item.user_membership[0].role as 'member' | 'moderator' | 'owner'
            : 'member',
          joined_at: item.user_membership[0].joined_at
        } : undefined
      }));
    },
    enabled: !!userId,
  });
};

// Mutation Hooks
export const useCreateForumTopic = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (topic: { category_id: string; title: string; content?: string; tags?: string[] }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('المستخدم غير مسجل الدخول');

      const { error } = await supabase
        .from('forum_topics')
        .insert({
          ...topic,
          author_id: user.id,
          tags: topic.tags || []
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forum-topics'] });
      toast({
        title: "تم إنشاء الموضوع بنجاح",
        description: "تم نشر موضوعك الجديد في المنتدى",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "خطأ في إنشاء الموضوع",
        description: error.message,
      });
    },
  });
};

export const useCreateForumPost = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (post: { topic_id: string; content: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('المستخدم غير مسجل الدخول');

      const { error } = await supabase
        .from('forum_posts')
        .insert({
          ...post,
          author_id: user.id
        });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['forum-posts', variables.topic_id] });
      toast({
        title: "تم إضافة الرد بنجاح",
        description: "تم نشر ردك في الموضوع",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "خطأ في إضافة الرد",
        description: error.message,
      });
    },
  });
};

export const useRSVPEvent = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, rsvp }: { eventId: string; rsvp: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('المستخدم غير مسجل الدخول');

      if (rsvp) {
        const { error } = await supabase
          .from('event_rsvps')
          .insert({
            event_id: eventId,
            user_id: user.id
          });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('event_rsvps')
          .delete()
          .eq('event_id', eventId)
          .eq('user_id', user.id);
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['community-events'] });
      toast({
        title: variables.rsvp ? "تم التسجيل بنجاح" : "تم إلغاء التسجيل",
        description: variables.rsvp ? "تم تسجيلك في الفعالية" : "تم إلغاء تسجيلك من الفعالية",
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "خطأ في التسجيل",
        description: error.message,
      });
    },
  });
};
