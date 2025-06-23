
import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Notification } from '@/types/notifications';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { 
  Gift, 
  Clock, 
  MessageCircle, 
  Info, 
  Star,
  Eye,
  Trash2,
  ExternalLink
} from 'lucide-react';

interface NotificationItemProps {
  notification: Notification;
  isSelected: boolean;
  onSelect: () => void;
  onMarkRead: () => void;
  onDelete: () => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  isSelected,
  onSelect,
  onMarkRead,
  onDelete,
}) => {
  const getIcon = () => {
    switch (notification.type) {
      case 'offer':
        return <Gift className="h-5 w-5 text-green-600" />;
      case 'deadline':
        return <Clock className="h-5 w-5 text-orange-600" />;
      case 'message':
        return <MessageCircle className="h-5 w-5 text-blue-600" />;
      case 'system':
        return <Info className="h-5 w-5 text-purple-600" />;
      case 'custom':
        return <Star className="h-5 w-5 text-yellow-600" />;
      default:
        return <Info className="h-5 w-5 text-gray-600" />;
    }
  };

  const getTypeLabel = () => {
    switch (notification.type) {
      case 'offer':
        return 'عرض جديد';
      case 'deadline':
        return 'موعد نهائي';
      case 'message':
        return 'رسالة';
      case 'system':
        return 'إشعار النظام';
      case 'custom':
        return 'تنبيه مخصص';
      default:
        return 'إشعار';
    }
  };

  const handleClick = () => {
    if (!notification.is_read) {
      onMarkRead();
    }
    if (notification.url) {
      window.location.href = notification.url;
    }
  };

  return (
    <Card className={`p-4 transition-all duration-200 hover:shadow-md ${
      !notification.is_read ? 'border-l-4 border-l-blue-500 bg-blue-50/50' : ''
    } ${isSelected ? 'ring-2 ring-blue-500' : ''}`}>
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <Checkbox
          checked={isSelected}
          onCheckedChange={onSelect}
          className="mt-1"
        />

        {/* Icon */}
        <div className="flex-shrink-0 mt-1">
          {getIcon()}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="secondary" className="text-xs">
                  {getTypeLabel()}
                </Badge>
                {!notification.is_read && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                )}
              </div>
              
              <h3 className={`font-semibold mb-2 ${
                !notification.is_read ? 'text-gray-900' : 'text-gray-700'
              }`}>
                {notification.title}
              </h3>
              
              <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                {notification.message}
              </p>
              
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(notification.created_at), {
                    addSuffix: true,
                    locale: ar
                  })}
                </span>
                
                <div className="flex items-center gap-1">
                  {notification.url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClick}
                      className="h-8 px-2"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  )}
                  
                  {!notification.is_read && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onMarkRead}
                      className="h-8 px-2"
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                  )}
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onDelete}
                    className="h-8 px-2 text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default NotificationItem;
