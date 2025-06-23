
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { StudentPreferences } from '@/types/profile';
import { Settings, Plus, X } from 'lucide-react';

interface PreferencesTabProps {
  preferences: StudentPreferences | null;
  onUpdate: () => void;
  userId: string;
}

const PreferencesTab: React.FC<PreferencesTabProps> = ({
  preferences,
  onUpdate,
  userId
}) => {
  return (
    <div className="space-y-6">
      {/* Interests */}
      <Card>
        <CardHeader>
          <CardTitle>الاهتمامات الأكاديمية</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {preferences?.interests?.map((interest, index) => (
                <Badge key={index} variant="secondary" className="flex items-center gap-1">
                  {interest}
                  <X className="h-3 w-3 cursor-pointer" />
                </Badge>
              ))}
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 ml-2" />
                إضافة اهتمام
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Destinations */}
      <Card>
        <CardHeader>
          <CardTitle>الوجهات المفضلة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {preferences?.destinations?.map((destination, index) => (
                <Badge key={index} variant="secondary" className="flex items-center gap-1">
                  {destination}
                  <X className="h-3 w-3 cursor-pointer" />
                </Badge>
              ))}
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 ml-2" />
                إضافة وجهة
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle>إعدادات الإشعارات</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="email-notifications">إشعارات البريد الإلكتروني</Label>
              <Switch 
                id="email-notifications" 
                checked={preferences?.notifications?.email || false}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="push-notifications">الإشعارات الفورية</Label>
              <Switch 
                id="push-notifications" 
                checked={preferences?.notifications?.push || false}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="app-notifications">إشعارات التطبيق</Label>
              <Switch 
                id="app-notifications" 
                checked={preferences?.notifications?.in_app || false}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PreferencesTab;
