
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Profile } from '@/types/profile';
import { User, Shield, Key, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import ProfilePhoto from './ProfilePhoto';

interface ProfileSettingsProps {
  profile: Profile;
  onProfileUpdate: () => void;
}

const ProfileSettings: React.FC<ProfileSettingsProps> = ({ profile, onProfileUpdate }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [editedProfile, setEditedProfile] = useState(profile);
  const { toast } = useToast();

  const handleSaveProfile = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editedProfile.full_name,
          phone_number: editedProfile.phone_number,
          city: editedProfile.city,
          bio: editedProfile.bio,
        })
        .eq('id', profile.id);

      if (error) throw error;

      toast({
        title: "تم التحديث بنجاح",
        description: "تم حفظ بياناتك بنجاح",
      });

      onProfileUpdate();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "خطأ في التحديث",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Tabs defaultValue="profile" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="profile" className="flex items-center gap-2">
          <User className="h-4 w-4" />
          الملف الشخصي
        </TabsTrigger>
        <TabsTrigger value="security" className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          الأمان
        </TabsTrigger>
        <TabsTrigger value="privacy" className="flex items-center gap-2">
          <Key className="h-4 w-4" />
          الخصوصية
        </TabsTrigger>
        <TabsTrigger value="preferences" className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          التفضيلات
        </TabsTrigger>
      </TabsList>

      <TabsContent value="profile">
        <Card>
          <CardHeader>
            <CardTitle>المعلومات الشخصية</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Profile Photo Section */}
            <ProfilePhoto
              userId={profile.id}
              avatarUrl={profile.avatar_url}
              fullName={profile.full_name}
              isEditing={true}
              onPhotoUpdate={onProfileUpdate}
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="full_name">الاسم الكامل</Label>
                <Input
                  id="full_name"
                  value={editedProfile.full_name}
                  onChange={e =>
                    setEditedProfile({ ...editedProfile, full_name: e.target.value })
                  }
                  disabled={isLoading}
                />
              </div>
              <div>
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input
                  id="email"
                  value={editedProfile.email}
                  disabled
                  readOnly
                />
              </div>
              <div>
                <Label htmlFor="phone">رقم الهاتف</Label>
                <Input
                  id="phone"
                  value={editedProfile.phone_number || ''}
                  onChange={e =>
                    setEditedProfile({ ...editedProfile, phone_number: e.target.value })
                  }
                  disabled={isLoading}
                />
              </div>
              <div>
                <Label htmlFor="city">المدينة</Label>
                <Input
                  id="city"
                  value={editedProfile.city || ''}
                  onChange={e =>
                    setEditedProfile({ ...editedProfile, city: e.target.value })
                  }
                  disabled={isLoading}
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="bio">النبذة الشخصية</Label>
              <Textarea
                id="bio"
                value={editedProfile.bio || ''}
                onChange={e =>
                  setEditedProfile({ ...editedProfile, bio: e.target.value })
                }
                disabled={isLoading}
                rows={3}
              />
            </div>
            
            <Button onClick={handleSaveProfile} disabled={isLoading}>
              {isLoading ? 'جار الحفظ...' : 'حفظ التغييرات'}
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="security">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>تغيير كلمة المرور</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="current_password">كلمة المرور الحالية</Label>
                <Input
                  id="current_password"
                  type="password"
                  disabled={isLoading}
                />
              </div>
              <div>
                <Label htmlFor="new_password">كلمة المرور الجديدة</Label>
                <Input
                  id="new_password"
                  type="password"
                  disabled={isLoading}
                />
              </div>
              <div>
                <Label htmlFor="confirm_password">تأكيد كلمة المرور</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  disabled={isLoading}
                />
              </div>
              <Button disabled={isLoading}>
                تحديث كلمة المرور
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>المصادقة الثنائية</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">تفعيل المصادقة الثنائية</p>
                  <p className="text-sm text-muted-foreground">
                    أضف طبقة حماية إضافية لحسابك
                  </p>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="privacy">
        <Card>
          <CardHeader>
            <CardTitle>إعدادات الخصوصية</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">الملف الشخصي العام</p>
                <p className="text-sm text-muted-foreground">
                  اجعل ملفك الشخصي مرئياً للآخرين
                </p>
              </div>
              <Switch />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">إظهار معلومات الاتصال</p>
                <p className="text-sm text-muted-foreground">
                  السماح للشركاء بمشاهدة بياناتك للتواصل
                </p>
              </div>
              <Switch />
            </div>
            
            <div className="space-y-2">
              <Button variant="outline">
                تصدير البيانات الشخصية
              </Button>
              <Button variant="destructive">
                حذف الحساب
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="preferences">
        <Card>
          <CardHeader>
            <CardTitle>تفضيلات الحساب</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="language">اللغة</Label>
              <select className="w-full border rounded px-3 py-2">
                <option value="ar">العربية</option>
                <option value="en">English</option>
              </select>
            </div>
            
            <div>
              <Label htmlFor="timezone">المنطقة الزمنية</Label>
              <select className="w-full border rounded px-3 py-2">
                <option value="Asia/Riyadh">الرياض (GMT+3)</option>
                <option value="Asia/Dubai">دبي (GMT+4)</option>
              </select>
            </div>
            
            <Button>
              حفظ التفضيلات
            </Button>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};

export default ProfileSettings;
