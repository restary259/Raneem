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
import { useTranslation } from 'react-i18next';

interface StudentProfileProps {
  profile: Profile;
  onProfileUpdate: (userId: string) => void;
  userId: string;
}

const visaStatusKeys: VisaStatus[] = ['not_applied', 'applied', 'approved', 'rejected', 'received'];

const StudentProfile: React.FC<StudentProfileProps> = ({ profile, onProfileUpdate, userId }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState(profile);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation('dashboard');

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const { error } = await (supabase as any)
        .from('profiles')
        .update({
          full_name: editedProfile.full_name,
          phone_number: editedProfile.phone_number,
          city: editedProfile.city,
          intake_month: editedProfile.intake_month,
          university_name: editedProfile.university_name,
          visa_status: editedProfile.visa_status,
          notes: editedProfile.notes,
        })
        .eq('id', userId);

      if (error) throw error;
      toast({ title: t('profile.updateSuccess'), description: t('profile.updateSuccessDesc') });
      setIsEditing(false);
      onProfileUpdate(userId);
    } catch (error: any) {
      toast({ variant: "destructive", title: t('profile.updateError'), description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('profile.title')}</CardTitle>
        {!isEditing && (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="ml-2">
            <Edit className="h-4 w-4" /> {t('profile.edit')}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>{t('profile.fullName')}</Label><Input value={editedProfile.full_name} onChange={e => setEditedProfile({ ...editedProfile, full_name: e.target.value })} disabled={!isEditing} required /></div>
            <div><Label>{t('profile.email')}</Label><Input value={editedProfile.email} disabled readOnly /></div>
            <div><Label>{t('profile.phone')}</Label><Input value={editedProfile.phone_number || ''} onChange={e => setEditedProfile({ ...editedProfile, phone_number: e.target.value })} disabled={!isEditing} /></div>
            <div><Label>{t('profile.city')}</Label><Input value={editedProfile.city || ''} onChange={e => setEditedProfile({ ...editedProfile, city: e.target.value })} disabled={!isEditing} /></div>
            <div><Label>{t('profile.intakeMonth')}</Label><Input value={editedProfile.intake_month || ''} onChange={e => setEditedProfile({ ...editedProfile, intake_month: e.target.value })} disabled={!isEditing} /></div>
            <div><Label>{t('profile.universityName')}</Label><Input value={editedProfile.university_name || ''} onChange={e => setEditedProfile({ ...editedProfile, university_name: e.target.value })} disabled={!isEditing} /></div>
            <div>
              <Label>{t('profile.visaStatus')}</Label>
              <select value={editedProfile.visa_status || ''} onChange={e => setEditedProfile({ ...editedProfile, visa_status: e.target.value as VisaStatus })} disabled={!isEditing} className="border rounded px-3 py-2 w-full">
                <option value="">{t('profile.selectStatus')}</option>
                {visaStatusKeys.map(s => <option key={s} value={s}>{t(`profile.visaStatuses.${s}`)}</option>)}
              </select>
            </div>
            <div className="md:col-span-2"><Label>{t('profile.notes')}</Label><Textarea value={editedProfile.notes || ''} onChange={e => setEditedProfile({ ...editedProfile, notes: e.target.value })} disabled={!isEditing} rows={3} /></div>
          </div>
          {isEditing && (
            <div className="flex justify-end gap-2 mt-4">
              <Button type="button" variant="outline" onClick={() => { setEditedProfile(profile); setIsEditing(false); }} disabled={isLoading}><X className="h-4 w-4" /> {t('profile.cancel')}</Button>
              <Button type="submit" disabled={isLoading}><Save className="h-4 w-4" /> {t('profile.save')}</Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
};

export default StudentProfile;
