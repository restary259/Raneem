import React, { useEffect, useState, useCallback } from 'react';
import { Bell, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Notification {
  id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  source: string;
}

function timeAgo(date: string, t: (key: string, opts?: any) => string): string {
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('notifications.justNow');
  if (mins < 60) return t('notifications.minutesAgo', { count: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('notifications.hoursAgo', { count: hrs });
  const days = Math.floor(hrs / 24);
  return t('notifications.daysAgo', { count: days });
}

const NotificationBell: React.FC = () => {
  const { t } = useTranslation('dashboard');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const fetchNotifications = useCallback(async (uid: string) => {
    const { data } = await (supabase as any)
      .from('notifications')
      .select('id, title, body, is_read, created_at, source')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) {
      setNotifications(data);
      setUnreadCount(data.filter((n: Notification) => !n.is_read).length);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      setUserId(session.user.id);
      fetchNotifications(session.user.id);
    };
    init();
  }, [fetchNotifications]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('notifications-bell')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload: any) => {
          const newNotif = payload.new as Notification;
          setNotifications(prev => [newNotif, ...prev].slice(0, 20));
          setUnreadCount(prev => prev + 1);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const markAsRead = async (id: string) => {
    await (supabase as any).from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllRead = async () => {
    if (!userId) return;
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    await (supabase as any).from('notifications').update({ is_read: true }).in('id', unreadIds);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative text-white/70 hover:text-white hover:bg-white/10 h-9 w-9 p-0">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -end-0.5 flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" sideOffset={8}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold text-sm">{t('notifications.title')}</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={markAllRead}>
              <Check className="h-3 w-3 me-1" />{t('notifications.markAllRead')}
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t('notifications.noNotifications')}</p>
          ) : (
            <div className="divide-y">
              {notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => !n.is_read && markAsRead(n.id)}
                  className={`w-full text-start px-4 py-3 hover:bg-muted/50 transition-colors ${!n.is_read ? 'bg-primary/5' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    {!n.is_read && <span className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" />}
                    <div className={!n.is_read ? '' : 'ps-4'}>
                      <p className="text-sm font-medium leading-tight">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">{timeAgo(n.created_at, t)}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
