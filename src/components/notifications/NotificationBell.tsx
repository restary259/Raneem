
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useNotifications } from '@/hooks/useNotifications';
import { Bell } from 'lucide-react';
import NotificationItem from './NotificationItem';

interface NotificationBellProps {
  userId: string;
  onOpenNotificationCenter?: () => void;
}

const NotificationBell: React.FC<NotificationBellProps> = ({
  userId,
  onOpenNotificationCenter,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const {
    notifications,
    unreadCount,
    markAsRead,
    deleteNotifications,
  } = useNotifications(userId, { limit: 5, is_read: false });

  const recentNotifications = notifications.slice(0, 3);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center text-xs p-0"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">الإشعارات</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary">{unreadCount} جديد</Badge>
            )}
          </div>
        </div>
        
        <div className="max-h-96 overflow-y-auto">
          {recentNotifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>لا توجد إشعارات جديدة</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {recentNotifications.map((notification) => (
                <div key={notification.id} className="p-2 hover:bg-muted rounded-lg">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm line-clamp-1">
                        {notification.title}
                      </h4>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {notification.message}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-muted-foreground">
                          {new Date(notification.created_at).toLocaleDateString('ar-SA')}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => markAsRead([notification.id])}
                          className="h-6 px-2 text-xs"
                        >
                          تحديد كمقروء
                        </Button>
                      </div>
                    </div>
                    {!notification.is_read && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-1 flex-shrink-0"></div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {(unreadCount > 3 || recentNotifications.length > 0) && (
          <div className="p-4 border-t">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setIsOpen(false);
                onOpenNotificationCenter?.();
              }}
            >
              عرض جميع الإشعارات
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
