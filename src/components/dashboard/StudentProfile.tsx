
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Edit, Save, X } from 'lucide-react';

interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone_number?: string;
  country?: string;
  intake_month?: string;
  university_name?: string;
  visa_status?: string;
  notes?: string;
}

interface StudentProfileProps {
  profile: Profile;
  onProfileUpdate: (userId: string) => void;
  userId: string;
}

const StudentProfile: React.FC<StudentProfileProps> = ({ profile, onProfileUpdate, userId }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState(profile);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editedProfile.full_name,
          phone_number: editedProfile.phone_number,
          country: editedProfile.country,
          intake_month: editedProfile.intake_month,
          university_name: editedProfile.university_name,
          visa_status: editedProfile.visa_status,
          notes: editedProfile.notes,
        })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: "تم التحديث بنجاح",
        description: "تم حفظ بياناتك بنجاح",
      });
      
      setIsEditing(false);
      onProfileUpdate(userId);
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

  const handleCancel = () => {
    setEditedProfile(profile);
    setIsEditing(false);
  };

  const visaStatuses = [
    { value: 'not_applied', label: 'لم يتم التقديم' },
    { value: 'applied', label: 'تم التقديم' },
    { value: 'approved', label: 'تمت الموافقة' },
    { value: 'rejected', label: 'تم الرفض' },
    { value: 'received', label: 'تم الاستلام' },
  ];

  const countries = [
    'السعودية', 'الإمارات', 'قطر', 'الكويت', 'البحرين', 'عمان',
    'الأردن', 'لبنان', 'سوريا', 'العراق', 'مصر', 'المغرب',
    'الجزائر', 'تونس', 'ليبيا', 'السودان', 'اليمن'
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl">البيانات الشخصية</CardTitle>
          <Button
            variant={isEditing ? "destructive" : "outline"}
            size="sm"
            onClick={isEditing ? handleCancel : () => setIsEditing(true)}
            className="flex items-center gap-2"
          >
            {isEditing ? <X className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
            {isEditing ? "إلغاء" : "تعديل"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">الاسم الكامل</Label>
              {isEditing ? (
                <Input
                  id="fullName"
                  value={editedProfile.full_name}
                  onChange={(e) => setEditedProfile({ ...editedProfile, full_name: e.target.value })}
                />
              ) : (
                <div className="text-sm p-2 bg-gray-50 rounded">{profile.full_name}</div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <div className="text-sm p-2 bg-gray-50 rounded">{profile.email}</div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">رقم الهاتف</Label>
              {isEditing ? (
                <Input
                  id="phone"
                  value={editedProfile.phone_number || ''}
                  onChange={(e) => setEditedProfile({ ...editedProfile, phone_number: e.target.value })}
                  placeholder="أدخل رقم هاتفك"
                />
              ) : (
                <div className="text-sm p-2 bg-gray-50 rounded">
                  {profile.phone_number || 'غير محدد'}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">البلد</Label>
              {isEditing ? (
                <Select
                  value={editedProfile.country || ''}
                  onValueChange={(value) => setEditedProfile({ ...editedProfile, country: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر البلد" />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map((country) => (
                      <SelectItem key={country} value={country}>
                        {country}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-sm p-2 bg-gray-50 rounded">
                  {profile.country || 'غير محدد'}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="intake">شهر الالتحاق</Label>
              {isEditing ? (
                <Input
                  id="intake"
                  value={editedProfile.intake_month || ''}
                  onChange={(e) => setEditedProfile({ ...editedProfile, intake_month: e.target.value })}
                  placeholder="مثال: سبتمبر 2024"
                />
              ) : (
                <div className="text-sm p-2 bg-gray-50 rounded">
                  {profile.intake_month || 'غير محدد'}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="university">الجامعة</Label>
              {isEditing ? (
                <Input
                  id="university"
                  value={editedProfile.university_name || ''}
                  onChange={(e) => setEditedProfile({ ...editedProfile, university_name: e.target.value })}
                  placeholder="أدخل اسم الجامعة"
                />
              ) : (
                <div className="text-sm p-2 bg-gray-50 rounded">
                  {profile.university_name || 'غير محدد'}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="visaStatus">حالة الفيزا</Label>
              {isEditing ? (
                <Select
                  value={editedProfile.visa_status || 'not_applied'}
                  onValueChange={(value) => setEditedProfile({ ...editedProfile, visa_status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {visaStatuses.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-sm p-2 bg-gray-50 rounded">
                  {visaStatuses.find(s => s.value === profile.visa_status)?.label || 'لم يتم التقديم'}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">ملاحظات</Label>
            {isEditing ? (
              <Textarea
                id="notes"
                value={editedProfile.notes || ''}
                onChange={(e) => setEditedProfile({ ...editedProfile, notes: e.target.value })}
                placeholder="أضف أي ملاحظات إضافية..."
                rows={3}
              />
            ) : (
              <div className="text-sm p-2 bg-gray-50 rounded min-h-[60px]">
                {profile.notes || 'لا توجد ملاحظات'}
              </div>
            )}
          </div>

          {isEditing && (
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={isLoading} className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                {isLoading ? "جار الحفظ..." : "حفظ التغييرات"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentProfile;
