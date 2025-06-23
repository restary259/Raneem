
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationFilter } from '@/types/notifications';
import { Bell, Search, Settings, Trash2, Eye, EyeOff } from 'lucide-react';
import NotificationItem from './NotificationItem';
import NotificationSettingsDialog from './NotificationSettingsDialog';

interface NotificationCenterProps {
  userId: string;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ userId }) => {
  const [filter, setFilter] = useState<NotificationFilter>({ limit: 20 });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('all');
  const [showSettings, setShowSettings] = useState(false);

  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAsUnread,
    deleteNotifications,
    isMarkingRead,
    isDeleting,
  } = useNotifications(userId, filter);

  // Filter notifications based on active tab
  const filteredNotifications = notifications.filter(notification => {
    // Search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      if (!notification.title.toLowerCase().includes(searchLower) &&
          !notification.message.toLowerCase().includes(searchLower)) {
        return false;
      }
    }

    // Tab filter
    switch (activeTab) {
      case 'unread':
        return !notification.is_read;
      case 'offers':
        return notification.type === 'offer';
      case 'deadlines':
        return notification.type === 'deadline';
      case 'messages':
        return notification.type === 'message';
      case 'system':
        return notification.type === 'system';
      default:
        return true;
    }
  });

  const handleSelectAll = () => {
    if (selectedIds.length === filteredNotifications.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredNotifications.map(n => n.id));
    }
  };

  const handleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  const handleBulkMarkRead = () => {
    markAsRead(selectedIds);
    setSelectedIds([]);
  };

  const handleBulkMarkUnread = () => {
    markAsUnread(selectedIds);
    setSelectedIds([]);
  };

  const handleBulkDelete = () => {
    deleteNotifications(selectedIds);
    setSelectedIds([]);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="h-6 w-6" />
              <CardTitle className="text-2xl">مركز الإشعارات</CardTitle>
              {unreadCount > 0 && (
                <Badge variant="destructive">{unreadCount}</Badge>
              )}
            </div>
            <Button
              variant="outline"
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              الإعدادات
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search and bulk actions */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="البحث في الإشعارات..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {selectedIds.length > 0 && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkMarkRead}
                  disabled={isMarkingRead}
                  className="flex items-center gap-1"
                >
                  <Eye className="h-4 w-4" />
                  تحديد كمقروء
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkMarkUnread}
                  disabled={isMarkingRead}
                  className="flex items-center gap-1"
                >
                  <EyeOff className="h-4 w-4" />
                  تحديد كغير مقروء
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={isDeleting}
                  className="flex items-center gap-1"
                >
                  <Trash2 className="h-4 w-4" />
                  حذف
                </Button>
              </div>
            )}
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="all">الكل</TabsTrigger>
              <TabsTrigger value="unread">غير مقروء</TabsTrigger>
              <TabsTrigger value="offers">عروض</TabsTrigger>
              <TabsTrigger value="deadlines">مواعيد</TabsTrigger>
              <TabsTrigger value="messages">رسائل</TabsTrigger>
              <TabsTrigger value="system">النظام</TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="mt-6">
              {/* Select all checkbox */}
              {filteredNotifications.length > 0 && (
                <div className="flex items-center gap-2 mb-4 pb-2 border-b">
                  <Checkbox
                    checked={selectedIds.length === filteredNotifications.length}
                    onCheckedChange={handleSelectAll}
                  />
                  <span className="text-sm text-muted-foreground">
                    تحديد الكل ({filteredNotifications.length})
                  </span>
                </div>
              )}

              {/* Notifications list */}
              <div className="space-y-2">
                {isLoading ? (
                  <div className="text-center py-8">
                    <div className="text-lg">جار تحميل الإشعارات...</div>
                  </div>
                ) : filteredNotifications.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>لا توجد إشعارات</p>
                  </div>
                ) : (
                  filteredNotifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      isSelected={selectedIds.includes(notification.id)}
                      onSelect={() => handleSelect(notification.id)}
                      onMarkRead={() => markAsRead([notification.id])}
                      onDelete={() => deleteNotifications([notification.id])}
                    />
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Settings Dialog */}
      <NotificationSettingsDialog
        userId={userId}
        open={showSettings}
        onOpenChange={setShowSettings}
      />
    </div>
  );
};

export default NotificationCenter;
