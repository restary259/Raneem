
import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Camera, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ProfilePhotoProps {
  userId: string;
  avatarUrl?: string;
  fullName?: string;
  isEditing?: boolean;
  onPhotoUpdate?: (url: string) => void;
}

const ProfilePhoto: React.FC<ProfilePhotoProps> = ({
  userId,
  avatarUrl,
  fullName,
  isEditing = false,
  onPhotoUpdate
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        variant: "destructive",
        title: "خطأ في نوع الملف",
        description: "يرجى اختيار صورة صالحة",
      });
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "حجم الملف كبير جداً",
        description: "يرجى اختيار صورة أصغر من 5 ميجابايت",
      });
      return;
    }

    setIsUploading(true);
    try {
      // Create a unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;

      // Create storage bucket if it doesn't exist
      const { error: bucketError } = await supabase.storage
        .from('avatars')
        .list('', { limit: 1 });

      if (bucketError && bucketError.message.includes('Bucket not found')) {
        // Create the bucket if it doesn't exist
        await supabase.storage.createBucket('avatars', {
          public: true,
          allowedMimeTypes: ['image/*'],
          fileSizeLimit: 5242880 // 5MB
        });
      }

      // Upload the file
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get the public URL
      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const publicUrl = data.publicUrl;

      // Update the profile with the new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);

      if (updateError) throw updateError;

      // Call the callback to update parent component
      if (onPhotoUpdate) {
        onPhotoUpdate(publicUrl);
      }

      toast({
        title: "تم تحديث الصورة بنجاح",
        description: "تم حفظ صورتك الشخصية الجديدة",
      });

    } catch (error: any) {
      console.error('Error uploading photo:', error);
      toast({
        variant: "destructive",
        title: "خطأ في تحميل الصورة",
        description: error.message,
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex items-center space-x-4 space-x-reverse">
      <div className="relative">
        <Avatar className="w-24 h-24">
          <AvatarImage src={avatarUrl} alt="Profile photo" />
          <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-3xl font-bold">
            {fullName?.charAt(0) || 'م'}
          </AvatarFallback>
        </Avatar>
        
        {isEditing && (
          <label className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full cursor-pointer hover:bg-blue-700 transition-colors">
            <Camera className="h-4 w-4" />
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              disabled={isUploading}
              className="hidden"
            />
          </label>
        )}
      </div>
      
      <div className="flex-1">
        <h3 className="text-lg font-semibold">{fullName || 'مستخدم'}</h3>
        {isEditing && (
          <div className="mt-2">
            <label className="cursor-pointer">
              <Button
                variant="outline"
                size="sm"
                disabled={isUploading}
                className="gap-2"
                asChild
              >
                <span>
                  <Upload className="h-4 w-4" />
                  {isUploading ? 'جار التحميل...' : 'تغيير الصورة'}
                </span>
              </Button>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                disabled={isUploading}
                className="hidden"
              />
            </label>
            <p className="text-xs text-muted-foreground mt-1">
              JPG, PNG أو GIF. حد أقصى 5MB
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePhoto;
