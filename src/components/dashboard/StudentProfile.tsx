import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Edit, Save, X } from 'lucide-react';
import { Profile, VisaStatus } from '@/types/profile';

interface StudentProfileProps {
  profile: Profile;
  onProfileUpdate: (userId: string) => void;
  userId: string;
}

const StudentProfile: React.FC<StudentProfileProps> = ({
  profile,
  onProfileUpdate,
  userId
}) => {
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
          city: editedProfile.city, // Changed from country to city
          intake_month: editedProfile.intake_month,
          university_name: editedProfile.university_name,
          visa_status: editedProfile.visa_status as VisaStatus,
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

  const visaStatuses: { value: VisaStatus; label: string }[] = [
    { value: 'not_applied', label: 'لم يتم التقديم' },
    { value: 'applied', label: 'تم التقديم' },
    { value: 'approved', label: 'تمت الموافقة' },
    { value: 'rejected', label: 'تم الرفض' },
    { value: 'received', label: 'تم الاستلام' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>الملف الشخصي</CardTitle>
        {!isEditing && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="ml-2"
          >
            <Edit className="h-4 w-4" />
            تعديل
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSave();
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Full Name */}
            <div>
              <Label htmlFor="full_name">الاسم الكامل</Label>
              <Input
                id="full_name"
                value={editedProfile.full_name}
                onChange={e =>
                  setEditedProfile({ ...editedProfile, full_name: e.target.value })
                }
                disabled={!isEditing}
                required
              />
            </div>
            {/* Email */}
            <div>
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input
                id="email"
                value={editedProfile.email}
                disabled
                readOnly
              />
            </div>
            {/* Phone Number */}
            <div>
              <Label htmlFor="phone_number">رقم الجوال</Label>
              <Input
                id="phone_number"
                value={editedProfile.phone_number || ''}
                onChange={e =>
                  setEditedProfile({ ...editedProfile, phone_number: e.target.value })
                }
                disabled={!isEditing}
              />
            </div>
            {/* City (editable text) */}
            <div>
              <Label htmlFor="city">المدينة</Label>
              <Input
                id="city"
                value={editedProfile.city || ''}
                onChange={e =>
                  setEditedProfile({ ...editedProfile, city: e.target.value })
                }
                disabled={!isEditing}
                placeholder="اكتب اسم مدينتك"
                required
              />
            </div>
            {/* Intake Month */}
            <div>
              <Label htmlFor="intake_month">شهر القبول</Label>
              <Input
                id="intake_month"
                value={editedProfile.intake_month || ''}
                onChange={e =>
                  setEditedProfile({ ...editedProfile, intake_month: e.target.value })
                }
                disabled={!isEditing}
              />
            </div>
            {/* University Name */}
            <div>
              <Label htmlFor="university_name">اسم الجامعة</Label>
              <Input
                id="university_name"
                value={editedProfile.university_name || ''}
                onChange={e =>
                  setEditedProfile({ ...editedProfile, university_name: e.target.value })
                }
                disabled={!isEditing}
              />
            </div>
            {/* Visa Status */}
            <div>
              <Label htmlFor="visa_status">حالة التأشيرة</Label>
              <select
                id="visa_status"
                value={editedProfile.visa_status || ''}
                onChange={e =>
                  setEditedProfile({ ...editedProfile, visa_status: e.target.value as VisaStatus })
                }
                disabled={!isEditing}
                className="border rounded px-3 py-2 w-full"
              >
                <option value="">اختر الحالة</option>
                {visaStatuses.map(status => (
                  <option value={status.value} key={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>
            {/* Notes */}
            <div className="md:col-span-2">
              <Label htmlFor="notes">ملاحظات</Label>
              <Textarea
                id="notes"
                value={editedProfile.notes || ''}
                onChange={e =>
                  setEditedProfile({ ...editedProfile, notes: e.target.value })
                }
                disabled={!isEditing}
                rows={3}
              />
            </div>
          </div>
          {isEditing && (
            <div className="flex justify-end gap-2 mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isLoading}
              >
                <X className="h-4 w-4" />
                إلغاء
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
              >
                <Save className="h-4 w-4" />
                حفظ
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
};

export default StudentProfile;
