
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNotificationSettings } from '@/hooks/useNotificationSettings';
import { NotificationSettings } from '@/types/notifications';
import { Bell, Mail, Smartphone, Globe } from 'lucide-react';

interface NotificationSettingsDialogProps {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NotificationSettingsDialog: React.FC<NotificationSettingsDialogProps> = ({
  userId,
  open,
  onOpenChange,
}) => {
  const { settings, isLoading, updateSettings, isUpdating } = useNotificationSettings(userId);

  if (isLoading || !settings) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <div className="flex items-center justify-center h-64">
            <div className="text-lg">جار تحميل الإعدادات...</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const handleChannelChange = (channel: keyof NotificationSettings['channels'], value: boolean) => {
    updateSettings({
      channels: {
        ...settings.channels,
        [channel]: value,
      },
    });
  };

  const handleFrequencyChange = (type: keyof NotificationSettings['frequency'], value: string) => {
    updateSettings({
      frequency: {
        ...settings.frequency,
        [type]: value as any,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            إعدادات الإشعارات
          </DialogTitle>
          <DialogDescription>
            تخصيص كيفية ومتى تريد تلقي الإشعارات
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Delivery Channels */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">قنوات التوصيل</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Smartphone className="h-5 w-5 text-blue-600" />
                  <div>
                    <Label className="text-base">الإشعارات داخل التطبيق</Label>
                    <p className="text-sm text-muted-foreground">
                      عرض الإشعارات والتنبيهات أثناء استخدام التطبيق
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.channels.inApp}
                  onCheckedChange={(value) => handleChannelChange('inApp', value)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5 text-green-600" />
                  <div>
                    <Label className="text-base">الإشعارات الفورية</Label>
                    <p className="text-sm text-muted-foreground">
                      تلقي إشعارات فورية حتى عند عدم فتح التطبيق
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.channels.push}
                  onCheckedChange={(value) => handleChannelChange('push', value)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-purple-600" />
                  <div>
                    <Label className="text-base">إشعارات البريد الإلكتروني</Label>
                    <p className="text-sm text-muted-foreground">
                      تلقي الإشعارات المهمة عبر البريد الإلكتروني
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.channels.email}
                  onCheckedChange={(value) => handleChannelChange('email', value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Frequency Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">تكرار الإشعارات</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">العروض والمنح</Label>
                  <p className="text-sm text-muted-foreground">
                    كم مرة تريد تلقي إشعارات العروض الجديدة
                  </p>
                </div>
                <Select
                  value={settings.frequency.offer}
                  onValueChange={(value) => handleFrequencyChange('offer', value)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instant">فوري</SelectItem>
                    <SelectItem value="daily">يومي</SelectItem>
                    <SelectItem value="weekly">أسبوعي</SelectItem>
                    <SelectItem value="off">إيقاف</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">المواعيد النهائية</Label>
                  <p className="text-sm text-muted-foreground">
                    تذكيرات بالمواعيد النهائية للتقديمات
                  </p>
                </div>
                <Select
                  value={settings.frequency.deadline}
                  onValueChange={(value) => handleFrequencyChange('deadline', value)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instant">فوري</SelectItem>
                    <SelectItem value="reminder">تذكير</SelectItem>
                    <SelectItem value="off">إيقاف</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">ملخص الإشعارات</Label>
                  <p className="text-sm text-muted-foreground">
                    ملخص دوري بجميع الإشعارات
                  </p>
                </div>
                <Select
                  value={settings.frequency.digest}
                  onValueChange={(value) => handleFrequencyChange('digest', value)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">يومي</SelectItem>
                    <SelectItem value="weekly">أسبوعي</SelectItem>
                    <SelectItem value="monthly">شهري</SelectItem>
                    <SelectItem value="off">إيقاف</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button disabled={isUpdating}>
              {isUpdating ? 'جار الحفظ...' : 'حفظ الإعدادات'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NotificationSettingsDialog;
