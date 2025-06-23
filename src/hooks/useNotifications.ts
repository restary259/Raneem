
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Notification, NotificationFilter, NotificationType } from '@/types/notifications';

export const useNotifications = (userId: string, filter?: NotificationFilter) => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch notifications
  const { data: notifications = [], isLoading, error } = useQuery({
    queryKey: ['notifications', userId, filter],
    queryFn: async () => {
      let query = supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (filter?.type) query = query.eq('type', filter.type);
      if (filter?.category) query = query.eq('category', filter.category);
      if (filter?.is_read !== undefined) query = query.eq('is_read', filter.is_read);
      if (filter?.limit) query = query.limit(filter.limit);
      if (filter?.offset) query = query.range(filter.offset, filter.offset + (filter.limit || 10) - 1);

      const { data, error } = await query;
      if (error) throw error;
      
      // Transform data to match our types
      return (data || []).map(item => ({
        ...item,
        type: ['offer', 'deadline', 'message', 'system', 'custom'].includes(item.type) 
          ? item.type as NotificationType 
          : 'system' as NotificationType
      })) as Notification[];
    },
    enabled: !!userId,
  });

  // Mark notifications as read
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationIds: string[]) => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .in('id', notificationIds);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "خطأ في تحديث الإشعارات",
        description: error.message,
      });
    },
  });

  // Mark notifications as unread
  const markAsUnreadMutation = useMutation({
    mutationFn: async (notificationIds: string[]) => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: false })
        .in('id', notificationIds);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Delete notifications
  const deleteNotificationsMutation = useMutation({
    mutationFn: async (notificationIds: string[]) => {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .in('id', notificationIds);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast({
        title: "تم حذف الإشعارات",
        description: "تم حذف الإشعارات المحددة بنجاح",
      });
    },
  });

  // Real-time subscription
  useEffect(() => {
    if (!userId || isSubscribed) return;

    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const newNotification = payload.new as any;
          
          // Show toast for new notifications
          if (newNotification.channel?.inApp) {
            toast({
              title: newNotification.title,
              description: newNotification.message,
            });

            // If there's a URL, log it for future navigation
            if (newNotification.url) {
              console.log('Notification URL available:', newNotification.url);
            }
          }

          // Invalidate queries to refresh the list
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
      )
      .subscribe();

    setIsSubscribed(true);

    return () => {
      supabase.removeChannel(channel);
      setIsSubscribed(false);
    };
  }, [userId, isSubscribed, queryClient, toast]);

  // Get unread count
  const unreadCount = notifications.filter(n => !n.is_read).length;

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    markAsRead: markAsReadMutation.mutate,
    markAsUnread: markAsUnreadMutation.mutate,
    deleteNotifications: deleteNotificationsMutation.mutate,
    isMarkingRead: markAsReadMutation.isPending,
    isDeleting: deleteNotificationsMutation.isPending,
  };
};
