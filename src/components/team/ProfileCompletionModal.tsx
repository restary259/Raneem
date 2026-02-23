import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Save } from 'lucide-react';
import { canTransition } from '@/lib/caseTransitions';
import { CaseStatus } from '@/lib/caseStatus';
import { LANGUAGE_SCHOOLS } from './TeamConstants';

interface ProfileCompletionModalProps {
  profileCase: any | null;
  leads: any[];
  userId?: string;
  onClose: () => void;
  onCompleted: (filter: string) => void;
  refetch: () => Promise<void>;
}

const ProfileCompletionModal: React.FC<ProfileCompletionModalProps> = ({
  profileCase, leads, userId, onClose, onCompleted, refetch,
}) => {
  const { toast } = useToast();
  const { t } = useTranslation('dashboard');

  const [profileValues, setProfileValues] = useState<Record<string, any>>({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [completeFileConfirm, setCompleteFileConfirm] = useState(false);
  const [pendingUpdateData, setPendingUpdateData] = useState<Record<string, any> | null>(null);

  React.useEffect(() => {
    if (!profileCase) return;
    const lead = leads.find(l => l.id === profileCase.lead_id);
    setProfileValues({
      student_full_name: profileCase.student_full_name || lead?.full_name || '',
      student_email: profileCase.student_email || lead?.email || '',
      student_phone: profileCase.student_phone || lead?.phone || '',
      student_address: profileCase.student_address || '',
      student_age: profileCase.student_age || '',
      language_proficiency: profileCase.language_proficiency || '',
      intensive_course: profileCase.intensive_course || '',
      passport_number: profileCase.passport_number || '',
      nationality: profileCase.nationality || '',
      country_of_birth: profileCase.country_of_birth || '',
      selected_city: profileCase.selected_city || '',
      selected_school: profileCase.selected_school || '',
      housing_description: profileCase.housing_description || '',
      has_translation_service: profileCase.has_translation_service || false,
      translation_added_by_user_id: profileCase.translation_added_by_user_id || null,
      gender: profileCase.gender || '',
      notes: profileCase.notes || '',
    });
  }, [profileCase, leads]);

  const saveProfileCompletion = async () => {
    if (!profileCase) return;
    setSavingProfile(true);
    const updateData: Record<string, any> = {
      student_full_name: profileValues.student_full_name || null,
      student_email: profileValues.student_email || null,
      student_phone: profileValues.student_phone || null,
      student_address: profileValues.student_address || null,
      student_age: profileValues.student_age ? Number(profileValues.student_age) : null,
      language_proficiency: profileValues.language_proficiency || null,
      intensive_course: profileValues.intensive_course || null,
      passport_number: profileValues.passport_number || null,
      nationality: profileValues.nationality || null,
      country_of_birth: profileValues.country_of_birth || null,
      selected_city: profileValues.selected_city || null,
      selected_school: profileValues.selected_school || null,
      housing_description: profileValues.housing_description || null,
      has_translation_service: !!profileValues.has_translation_service,
      translation_added_by_user_id:
        profileCase.translation_added_by_user_id && profileValues.has_translation_service
          ? profileCase.translation_added_by_user_id
          : (profileValues.has_translation_service ? userId ?? null : null),
      gender: profileValues.gender || null,
      notes: profileValues.notes || null,
    };

    const requiredProfileFields = [
      'student_full_name', 'student_email', 'student_phone', 'student_age', 'student_address',
      'passport_number', 'nationality', 'country_of_birth', 'language_proficiency',
      'gender', 'selected_city', 'selected_school', 'intensive_course'
    ];
    const missingFields = requiredProfileFields.filter(f => {
      const val = profileValues[f];
      return !val || String(val).trim() === '' || String(val).trim() === 'null';
    });

    if (missingFields.length > 0) {
      const fieldLabels: Record<string, string> = {
        student_full_name: t('admin.ready.fullName'),
        student_email: t('admin.ready.email'),
        student_phone: t('admin.ready.phone'),
        student_age: t('admin.ready.age'),
        student_address: t('admin.ready.address'),
        passport_number: t('admin.ready.passportNumber'),
        nationality: t('admin.ready.nationality'),
        country_of_birth: t('admin.ready.countryOfBirth'),
        language_proficiency: t('admin.ready.languageProficiency'),
        gender: t('lawyer.gender'),
        selected_city: t('admin.ready.destinationCity'),
        selected_school: t('admin.ready.schoolLabel'),
        intensive_course: t('admin.ready.intensiveCourse'),
      };
      const missing = missingFields.map(f => fieldLabels[f] || f).join(', ');
      toast({ variant: 'destructive', title: t('lawyer.missingFields'), description: missing });
      setSavingProfile(false);
      return;
    }

    setPendingUpdateData(updateData);
    setSavingProfile(false);
    setCompleteFileConfirm(true);
  };

  const confirmCompleteFile = async () => {
    if (!profileCase || !pendingUpdateData) return;
    setSavingProfile(true);
    try {
      const finalData = { ...pendingUpdateData };
      if (canTransition(profileCase.case_status, CaseStatus.PROFILE_FILLED)) {
        finalData.case_status = CaseStatus.PROFILE_FILLED;
      } else {
        toast({ variant: 'destructive', title: t('common.error'), description: t('lawyer.cannotTransition') });
        return;
      }
      const { error } = await (supabase as any).from('student_cases').update(finalData).eq('id', profileCase.id);
      if (error) {
        toast({ variant: 'destructive', title: t('common.error'), description: error.message });
      } else {
        await (supabase as any).rpc('log_user_activity', { p_action: 'profile_completed', p_target_id: profileCase.id, p_target_table: 'student_cases' });
        toast({ title: t('lawyer.fileCompleted') });
        onClose();
        onCompleted('profile_filled');
        try { await refetch(); } catch {}
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        toast({ variant: 'destructive', title: t('common.error'), description: err?.message || 'Unexpected error' });
      }
    } finally {
      setSavingProfile(false);
      setCompleteFileConfirm(false);
      setPendingUpdateData(null);
    }
  };

  const cancelCompleteFile = () => {
    setCompleteFileConfirm(false);
    setPendingUpdateData(null);
  };

  return (
    <>
      <Dialog open={!!profileCase} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" aria-describedby="profile-completion-desc">
          <DialogHeader>
            <DialogTitle>{t('lawyer.completeProfile')}</DialogTitle>
            <p id="profile-completion-desc" className="text-sm text-muted-foreground">{t('lawyer.completeProfileDesc')}</p>
          </DialogHeader>

          <Tabs defaultValue="personal" className="mt-2">
            <TabsList className="w-full">
              <TabsTrigger value="personal" className="flex-1 text-xs">{t('lawyer.personalInfo')}</TabsTrigger>
              <TabsTrigger value="services" className="flex-1 text-xs">{t('lawyer.servicesTab')}</TabsTrigger>
              <TabsTrigger value="notes" className="flex-1 text-xs">{t('lawyer.notesTab')}</TabsTrigger>
            </TabsList>

            <TabsContent value="personal">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <div><Label>{t('admin.ready.fullName')}</Label><Input value={profileValues.student_full_name || ''} onChange={e => setProfileValues(v => ({ ...v, student_full_name: e.target.value }))} /></div>
                <div><Label>{t('admin.ready.email')}</Label><Input type="email" value={profileValues.student_email || ''} onChange={e => setProfileValues(v => ({ ...v, student_email: e.target.value }))} /></div>
                <div><Label>{t('admin.ready.phone')}</Label><Input value={profileValues.student_phone || ''} onChange={e => setProfileValues(v => ({ ...v, student_phone: e.target.value }))} /></div>
                <div><Label>{t('admin.ready.age')}</Label><Input type="number" value={profileValues.student_age || ''} onChange={e => setProfileValues(v => ({ ...v, student_age: e.target.value }))} /></div>
                <div className="md:col-span-2"><Label>{t('admin.ready.address')}</Label><Input value={profileValues.student_address || ''} onChange={e => setProfileValues(v => ({ ...v, student_address: e.target.value }))} /></div>
                <div><Label>{t('admin.ready.passportNumber')}</Label><Input value={profileValues.passport_number || ''} onChange={e => setProfileValues(v => ({ ...v, passport_number: e.target.value }))} /></div>
                <div><Label>{t('admin.ready.nationality')}</Label><Input value={profileValues.nationality || ''} onChange={e => setProfileValues(v => ({ ...v, nationality: e.target.value }))} /></div>
                <div><Label>{t('admin.ready.countryOfBirth')}</Label><Input value={profileValues.country_of_birth || ''} onChange={e => setProfileValues(v => ({ ...v, country_of_birth: e.target.value }))} /></div>
                <div><Label>{t('admin.ready.languageProficiency')}</Label><Input value={profileValues.language_proficiency || ''} onChange={e => setProfileValues(v => ({ ...v, language_proficiency: e.target.value }))} placeholder="e.g. German B1" /></div>
                <div>
                  <Label>{t('lawyer.gender')}</Label>
                  <Select value={profileValues.gender || ''} onValueChange={v => setProfileValues(ev => ({ ...ev, gender: v }))}>
                    <SelectTrigger><SelectValue placeholder={t('lawyer.genderSelect')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">{t('lawyer.male')}</SelectItem>
                      <SelectItem value="female">{t('lawyer.female')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="services">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <div><Label>{t('admin.ready.destinationCity')}</Label><Input value={profileValues.selected_city || ''} onChange={e => setProfileValues(v => ({ ...v, selected_city: e.target.value }))} /></div>
                <div>
                  <Label>{t('admin.ready.schoolLabel')}</Label>
                  <Select value={profileValues.selected_school || ''} onValueChange={v => setProfileValues(ev => ({ ...ev, selected_school: v }))}>
                    <SelectTrigger><SelectValue placeholder={t('lawyer.selectSchool')} /></SelectTrigger>
                    <SelectContent>
                      {LANGUAGE_SCHOOLS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('admin.ready.intensiveCourse')}</Label>
                  <Select value={profileValues.intensive_course || ''} onValueChange={v => setProfileValues(ev => ({ ...ev, intensive_course: v }))}>
                    <SelectTrigger><SelectValue placeholder={t('lawyer.selectLabel')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">{t('lawyer.yesLabel')}</SelectItem>
                      <SelectItem value="no">{t('lawyer.noLabel')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label>{t('lawyer.housingType')}</Label>
                  <Input value={profileValues.housing_description || ''} onChange={e => setProfileValues(v => ({ ...v, housing_description: e.target.value }))} placeholder={t('lawyer.housingPlaceholder')} />
                </div>
                <div className="md:col-span-2 flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                  <input type="checkbox" id="has_translation_service" checked={!!profileValues.has_translation_service} onChange={e => setProfileValues(v => ({ ...v, has_translation_service: e.target.checked }))} className="h-4 w-4 rounded border-input" />
                  <Label htmlFor="has_translation_service" className="cursor-pointer text-sm">{t('lawyer.translationService')}</Label>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="notes">
              <div className="mt-2">
                <Label>{t('lawyer.specialNotes')}</Label>
                <Textarea value={profileValues.notes || ''} onChange={e => setProfileValues(v => ({ ...v, notes: e.target.value }))} rows={5} />
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            <Button onClick={saveProfileCompletion} disabled={savingProfile}>
              <Save className="h-4 w-4 me-1" />{savingProfile ? t('common.loading') : t('common.save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={completeFileConfirm} onOpenChange={(open) => { if (!open) { setSavingProfile(false); cancelCompleteFile(); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('lawyer.completeStudentFile')}</AlertDialogTitle>
            <AlertDialogDescription>{t('lawyer.completeStudentFileDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelCompleteFile}>{t('lawyer.close')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCompleteFile} disabled={savingProfile}>
              {savingProfile ? t('common.loading') : t('lawyer.yesCompleteFile')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ProfileCompletionModal;
