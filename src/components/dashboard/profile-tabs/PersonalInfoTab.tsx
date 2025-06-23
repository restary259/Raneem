
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Profile } from '@/types/profile';
import { Save, X, Upload, Camera } from 'lucide-react';

interface PersonalInfoTabProps {
  profile: Profile;
  isEditing: boolean;
  onUpdate: () => void;
  userId: string;
}

const PersonalInfoTab: React.FC<PersonalInfoTabProps> = ({
  profile,
  isEditing,
  onUpdate,
  userId
}) => {
  const [editedProfile, setEditedProfile] = useState(profile);
  const [isLoading, setIsLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const { toast } = useToast();

  const handleSave = async () => {
    setIsLoading(true);
    try {
      let avatarUrl = editedProfile.avatar_url;

      // Upload avatar if changed
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${userId}-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, avatarFile);

        if (uploadError) {
          console.error('Avatar upload error:', uploadError);
          // Continue without avatar update
        } else {
          const { data } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);
          avatarUrl = data.publicUrl;
        }
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editedProfile.full_name,
          first_name: editedProfile.first_name,
          last_name: editedProfile.last_name,
          preferred_name: editedProfile.preferred_name,
          pronouns: editedProfile.pronouns,
          avatar_url: avatarUrl,
          phone_number: editedProfile.phone_number,
          phone: editedProfile.phone,
          country: editedProfile.country,
          city: editedProfile.city,
          bio: editedProfile.bio,
        })
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: "تم التحديث بنجاح",
        description: "تم حفظ معلوماتك الشخصية بنجاح",
      });

      onUpdate();
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
    setAvatarFile(null);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>المعلومات الشخصية</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Avatar Section */}
          <div className="flex items-center space-x-4 space-x-reverse">
            <div className="relative">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-3xl font-bold overflow-hidden">
                {editedProfile.avatar_url ? (
                  <img 
                    src={editedProfile.avatar_url} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  editedProfile.full_name?.charAt(0) || 'م'
                )}
              </div>
              {isEditing && (
                <label className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full cursor-pointer hover:bg-blue-700">
                  <Camera className="h-4 w-4" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold">{editedProfile.full_name}</h3>
              <p className="text-muted-foreground">{editedProfile.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Full Name */}
            <div>
              <Label htmlFor="full_name">الاسم الكامل *</Label>
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

            {/* Preferred Name */}
            <div>
              <Label htmlFor="preferred_name">الاسم المفضل</Label>
              <Input
                id="preferred_name"
                value={editedProfile.preferred_name || ''}
                onChange={e =>
                  setEditedProfile({ ...editedProfile, preferred_name: e.target.value })
                }
                disabled={!isEditing}
              />
            </div>

            {/* First Name */}
            <div>
              <Label htmlFor="first_name">الاسم الأول</Label>
              <Input
                id="first_name"
                value={editedProfile.first_name || ''}
                onChange={e =>
                  setEditedProfile({ ...editedProfile, first_name: e.target.value })
                }
                disabled={!isEditing}
              />
            </div>

            {/* Last Name */}
            <div>
              <Label htmlFor="last_name">الاسم الأخير</Label>
              <Input
                id="last_name"
                value={editedProfile.last_name || ''}
                onChange={e =>
                  setEditedProfile({ ...editedProfile, last_name: e.target.value })
                }
                disabled={!isEditing}
              />
            </div>

            {/* Pronouns */}
            <div>
              <Label htmlFor="pronouns">الضمائر</Label>
              <Input
                id="pronouns"
                value={editedProfile.pronouns || ''}
                onChange={e =>
                  setEditedProfile({ ...editedProfile, pronouns: e.target.value })
                }
                disabled={!isEditing}
                placeholder="مثال: هو/هي"
              />
            </div>

            {/* Email (Read Only) */}
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
                value={editedProfile.phone_number || editedProfile.phone || ''}
                onChange={e =>
                  setEditedProfile({ ...editedProfile, phone_number: e.target.value })
                }
                disabled={!isEditing}
                type="tel"
              />
            </div>

            {/* Country */}
            <div>
              <Label htmlFor="country">الدولة</Label>
              <Input
                id="country"
                value={editedProfile.country || ''}
                onChange={e =>
                  setEditedProfile({ ...editedProfile, country: e.target.value })
                }
                disabled={!isEditing}
              />
            </div>

            {/* City */}
            <div>
              <Label htmlFor="city">المدينة</Label>
              <Input
                id="city"
                value={editedProfile.city || ''}
                onChange={e =>
                  setEditedProfile({ ...editedProfile, city: e.target.value })
                }
                disabled={!isEditing}
              />
            </div>
          </div>

          {/* Bio */}
          <div>
            <Label htmlFor="bio">نبذة شخصية</Label>
            <Textarea
              id="bio"
              value={editedProfile.bio || ''}
              onChange={e =>
                setEditedProfile({ ...editedProfile, bio: e.target.value })
              }
              disabled={!isEditing}
              rows={4}
              placeholder="اكتب نبذة مختصرة عن نفسك وأهدافك الأكاديمية..."
            />
          </div>

          {isEditing && (
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isLoading}
              >
                <X className="h-4 w-4 ml-2" />
                إلغاء
              </Button>
              <Button
                onClick={handleSave}
                disabled={isLoading}
              >
                <Save className="h-4 w-4 ml-2" />
                حفظ التغييرات
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default PersonalInfoTab;
