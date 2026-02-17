import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Edit, Save, X, User, GraduationCap } from 'lucide-react';
import { Profile, VisaStatus } from '@/types/profile';
import { useTranslation } from 'react-i18next';

interface StudentProfileProps {
  profile: Profile;
  onProfileUpdate: (userId: string) => void;
  userId: string;
}

const visaStatusKeys: VisaStatus[] = ['not_applied', 'applied', 'approved', 'rejected', 'received'];
const eyeColorOptions = ['brown', 'blue', 'green', 'hazel', 'gray', 'other'];

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
          notes: editedProfile.notes,
          gender: editedProfile.gender,
          eye_color: editedProfile.eye_color,
          has_changed_legal_name: editedProfile.has_changed_legal_name,
          previous_legal_name: editedProfile.previous_legal_name,
          has_criminal_record: editedProfile.has_criminal_record,
          criminal_record_details: editedProfile.criminal_record_details,
          has_dual_citizenship: editedProfile.has_dual_citizenship,
          second_passport_country: editedProfile.second_passport_country,
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
    <div className="space-y-6">
      {/* Section 1: Personal Information */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <CardTitle>{t('profile.personalInfo', 'Personal Information')}</CardTitle>
          </div>
          {!isEditing && (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Edit className="h-4 w-4 me-1" /> {t('profile.edit')}
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
              <div>
                <Label>{t('profile.gender', 'Gender')}</Label>
                <Select value={editedProfile.gender || ''} onValueChange={v => setEditedProfile({ ...editedProfile, gender: v })} disabled={!isEditing}>
                  <SelectTrigger><SelectValue placeholder={t('profile.selectGender', 'Select gender')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">{t('profile.genderMale', 'Male')}</SelectItem>
                    <SelectItem value="female">{t('profile.genderFemale', 'Female')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('profile.eyeColor', 'Eye Color')}</Label>
                <Select value={editedProfile.eye_color || ''} onValueChange={v => setEditedProfile({ ...editedProfile, eye_color: v })} disabled={!isEditing}>
                  <SelectTrigger><SelectValue placeholder={t('profile.selectEyeColor', 'Select eye color')} /></SelectTrigger>
                  <SelectContent>
                    {eyeColorOptions.map(c => <SelectItem key={c} value={c}>{t(`profile.eyeColors.${c}`, c.charAt(0).toUpperCase() + c.slice(1))}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Legal Fields */}
            <div className="mt-6 space-y-4 border-t pt-4">
              <h3 className="font-semibold text-sm text-muted-foreground">{t('profile.legalSection', 'Legal / Visa Information')}</h3>
              
              <div className="flex items-center justify-between">
                <Label>{t('profile.hasChangedLegalName', 'Have you ever changed your legal name?')}</Label>
                <Switch checked={!!editedProfile.has_changed_legal_name} onCheckedChange={v => setEditedProfile({ ...editedProfile, has_changed_legal_name: v, previous_legal_name: v ? editedProfile.previous_legal_name : '' })} disabled={!isEditing} />
              </div>
              {editedProfile.has_changed_legal_name && (
                <div><Label>{t('profile.previousLegalName', 'Previous Legal Name')}</Label><Input value={editedProfile.previous_legal_name || ''} onChange={e => setEditedProfile({ ...editedProfile, previous_legal_name: e.target.value })} disabled={!isEditing} /></div>
              )}

              <div className="flex items-center justify-between">
                <Label>{t('profile.hasCriminalRecord', 'Do you have a criminal record?')}</Label>
                <Switch checked={!!editedProfile.has_criminal_record} onCheckedChange={v => setEditedProfile({ ...editedProfile, has_criminal_record: v, criminal_record_details: v ? editedProfile.criminal_record_details : '' })} disabled={!isEditing} />
              </div>
              {editedProfile.has_criminal_record && (
                <div><Label>{t('profile.criminalRecordDetails', 'Criminal Record Details')}</Label><Textarea value={editedProfile.criminal_record_details || ''} onChange={e => setEditedProfile({ ...editedProfile, criminal_record_details: e.target.value })} disabled={!isEditing} rows={2} /></div>
              )}

              <div className="flex items-center justify-between">
                <Label>{t('profile.hasDualCitizenship', 'Do you have dual citizenship?')}</Label>
                <Switch checked={!!editedProfile.has_dual_citizenship} onCheckedChange={v => setEditedProfile({ ...editedProfile, has_dual_citizenship: v, second_passport_country: v ? editedProfile.second_passport_country : '' })} disabled={!isEditing} />
              </div>
              {editedProfile.has_dual_citizenship && (
                <div><Label>{t('profile.secondPassportCountry', 'Second Passport Country')}</Label><Input value={editedProfile.second_passport_country || ''} onChange={e => setEditedProfile({ ...editedProfile, second_passport_country: e.target.value })} disabled={!isEditing} /></div>
              )}
            </div>

            <div className="mt-4">
              <Label>{t('profile.notes')}</Label>
              <Textarea value={editedProfile.notes || ''} onChange={e => setEditedProfile({ ...editedProfile, notes: e.target.value })} disabled={!isEditing} rows={3} />
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

      {/* Section 2: Application / Visa Info (Read-Only for students) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            <CardTitle>{t('profile.applicationInfo', 'Visa & Language School Info')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>{t('profile.languageSchool', 'Language School')}</Label>
              <Input value={editedProfile.university_name || ''} onChange={e => setEditedProfile({ ...editedProfile, university_name: e.target.value })} disabled={!isEditing} />
            </div>
            <div>
              <Label>{t('profile.intakeMonth')}</Label>
              <Input value={editedProfile.intake_month || ''} onChange={e => setEditedProfile({ ...editedProfile, intake_month: e.target.value })} disabled={!isEditing} />
            </div>
            <div>
              <Label>{t('profile.visaStatus')}</Label>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={
                  editedProfile.visa_status === 'approved' || editedProfile.visa_status === 'received' ? 'default' :
                  editedProfile.visa_status === 'rejected' ? 'destructive' : 'secondary'
                }>
                  {t(`profile.visaStatuses.${editedProfile.visa_status || 'not_applied'}`)}
                </Badge>
                <span className="text-xs text-muted-foreground">{t('profile.visaAdminOnly', 'Updated by admin only')}</span>
              </div>
            </div>
            <div>
              <Label>{t('profile.arrivalDate', 'Arrival Date in Germany')}</Label>
              <Input
                type="date"
                value={editedProfile.arrival_date || ''}
                disabled
                readOnly
                className="bg-muted"
              />
              <span className="text-xs text-muted-foreground">{t('profile.arrivalDateAdminOnly', 'Set by admin')}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentProfile;
