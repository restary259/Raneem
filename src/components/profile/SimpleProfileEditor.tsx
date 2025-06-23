
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Profile } from '@/types/profile';
import { Save, X } from 'lucide-react';

interface SimpleProfileEditorProps {
  profile: Profile | null;
  userId: string;
  onSave: () => void;
  onCancel: () => void;
}

const SimpleProfileEditor: React.FC<SimpleProfileEditorProps> = ({
  profile,
  userId,
  onSave,
  onCancel
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
    first_name: profile?.first_name || '',
    last_name: profile?.last_name || '',
    phone: profile?.phone || profile?.phone_number || '',
    city: profile?.city || '',
    bio: profile?.bio || '',
  });
  const { toast } = useToast();

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const updateData = {
        full_name: formData.full_name || `${formData.first_name} ${formData.last_name}`.trim(),
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formData.phone,
        phone_number: formData.phone,
        city: formData.city,
        bio: formData.bio,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          ...updateData,
        });

      if (error) throw error;

      toast({
        title: "Profile Updated",
        description: "Your profile has been saved successfully.",
      });

      onSave();
    } catch (error: any) {
      console.error('Error saving profile:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save profile",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Edit Profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="first_name">First Name</Label>
            <Input
              id="first_name"
              value={formData.first_name}
              onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              disabled={isLoading}
            />
          </div>
          <div>
            <Label htmlFor="last_name">Last Name</Label>
            <Input
              id="last_name"
              value={formData.last_name}
              onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              disabled={isLoading}
            />
          </div>
        </div>
        
        <div>
          <Label htmlFor="full_name">Full Name (Display Name)</Label>
          <Input
            id="full_name"
            value={formData.full_name}
            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            disabled={isLoading}
            placeholder={`${formData.first_name} ${formData.last_name}`.trim()}
          />
        </div>

        <div>
          <Label htmlFor="phone">Phone Number</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            disabled={isLoading}
          />
        </div>

        <div>
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            disabled={isLoading}
          />
        </div>

        <div>
          <Label htmlFor="bio">Bio</Label>
          <Textarea
            id="bio"
            value={formData.bio}
            onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
            disabled={isLoading}
            rows={3}
            placeholder="Tell us about yourself..."
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isLoading}
          >
            <Save className="h-4 w-4 mr-2" />
            {isLoading ? 'Saving...' : 'Save Profile'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SimpleProfileEditor;
