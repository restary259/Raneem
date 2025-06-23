
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { NotificationFilter } from '@/types/notifications';

export const useNotifications = (userId: string, options: NotificationFilter = {}) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingRead, setIsMarkingRead] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const fetchNotifications = async () => {
      try {
        let query = supabase
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        // Apply filters
        if (options.is_read !== undefined) {
          query = query.eq('is_read', options.is_read);
        }
        
        if (options.type) {
          query = query.eq('type', options.type);
        }
        
        if (options.category) {
          query = query.eq('category', options.category);
        }
        
        if (options.limit) {
          query = query.limit(options.limit);
        }

        const { data, error } = await query;

        if (error) throw error;

        setNotifications(data || []);
        
        // Count unread notifications separately
        const { data: unreadData, error: unreadError } = await supabase
          .from('notifications')
          .select('id')
          .eq('user_id', userId)
          .eq('is_read', false);

        if (!unreadError) {
          setUnreadCount(unreadData?.length || 0);
        }
      } catch (error) {
        console.error('Error fetching notifications:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNotifications();

    // Set up real-time subscription
    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, options.limit, options.is_read, options.type, options.category]);

  const markAsRead = async (notificationIds: string[]) => {
    setIsMarkingRead(true);
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .in('id', notificationIds)
        .eq('user_id', userId);

      if (error) throw error;

      // Update local state
      setNotifications(prev => 
        prev.map(notif => 
          notificationIds.includes(notif.id) 
            ? { ...notif, is_read: true }
            : notif
        )
      );
      
      setUnreadCount(prev => Math.max(0, prev - notificationIds.length));
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    } finally {
      setIsMarkingRead(false);
    }
  };

  const markAsUnread = async (notificationIds: string[]) => {
    setIsMarkingRead(true);
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: false })
        .in('id', notificationIds)
        .eq('user_id', userId);

      if (error) throw error;

      // Update local state
      setNotifications(prev => 
        prev.map(notif => 
          notificationIds.includes(notif.id) 
            ? { ...notif, is_read: false }
            : notif
        )
      );
      
      setUnreadCount(prev => prev + notificationIds.length);
    } catch (error) {
      console.error('Error marking notifications as unread:', error);
    } finally {
      setIsMarkingRead(false);
    }
  };

  const deleteNotifications = async (notificationIds: string[]) => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .in('id', notificationIds)
        .eq('user_id', userId);

      if (error) throw error;

      // Update local state
      const deletedUnreadCount = notifications
        .filter(notif => notificationIds.includes(notif.id) && !notif.is_read)
        .length;

      setNotifications(prev => 
        prev.filter(notif => !notificationIds.includes(notif.id))
      );
      
      setUnreadCount(prev => Math.max(0, prev - deletedUnreadCount));
    } catch (error) {
      console.error('Error deleting notifications:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAsUnread,
    deleteNotifications,
    isMarkingRead,
    isDeleting,
  };
};
