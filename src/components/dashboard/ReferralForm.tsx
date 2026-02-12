import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, Users } from 'lucide-react';
import ReferralTracker from './ReferralTracker';
import { useTranslation } from 'react-i18next';

interface ReferralFormProps {
  userId: string;
}

const ReferralForm: React.FC<ReferralFormProps> = ({ userId }) => {
  const { toast } = useToast();
  const { t } = useTranslation('dashboard');
  const [isLoading, setIsLoading] = useState(false);
  const [isFamily, setIsFamily] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [form, setForm] = useState({
    first_name: '', surname: '', email: '', phone: '', country: '', city: '', dob: '', gender: '', german_level: '',
  });

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAccepted) {
      toast({ variant: 'destructive', title: t('referrals.termsError') });
      return;
    }
    const phoneRegex = /^\+?\d{7,15}$/;
    if (!phoneRegex.test(form.phone.replace(/[\s\-()]/g, ''))) {
      toast({ variant: 'destructive', title: t('referrals.phoneError'), description: t('referrals.phoneErrorDesc') });
      return;
    }
    const { data: selfProfile } = await (supabase as any).from('profiles').select('email').eq('id', userId).maybeSingle();
    if (selfProfile && form.email.toLowerCase() === selfProfile.email?.toLowerCase()) {
      toast({ variant: 'destructive', title: t('referrals.selfReferralError') });
      return;
    }
    const { data: existing } = await (supabase as any).from('referrals').select('id').eq('referred_email', form.email).eq('referrer_id', userId);
    if (existing?.length) {
      toast({ variant: 'destructive', title: t('referrals.duplicateError') });
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await (supabase as any).from('referrals').insert({
        referrer_id: userId, referrer_type: 'student',
        referred_name: `${form.first_name} ${form.surname}`.trim(),
        referred_email: form.email, referred_phone: form.phone,
        referred_country: form.country || null, referred_city: form.city || null,
        referred_dob: form.dob || null, referred_gender: form.gender || null,
        referred_german_level: form.german_level || null,
        is_family: isFamily, status: 'pending', terms_accepted_at: new Date().toISOString(),
      });
      if (error) throw error;
      toast({ title: t('referrals.success') });
      setForm({ first_name: '', surname: '', email: '', phone: '', country: '', city: '', dob: '', gender: '', german_level: '' });
      setIsFamily(false);
      setTermsAccepted(false);
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('common.error'), description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            {t('referrals.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-6 p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <Checkbox id="isFamily" checked={isFamily} onCheckedChange={(v) => setIsFamily(v === true)} />
              <Label htmlFor="isFamily" className="flex items-center gap-1 cursor-pointer">
                <Users className="h-4 w-4" />
                {t('referrals.familyLabel')}
              </Label>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">{t('referrals.firstName')} *</Label>
              <Input id="first_name" value={form.first_name} onChange={e => updateField('first_name', e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="surname">{t('referrals.surname')} *</Label>
              <Input id="surname" value={form.surname} onChange={e => updateField('surname', e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ref_email">{t('referrals.emailLabel')} *</Label>
              <Input id="ref_email" type="email" value={form.email} onChange={e => updateField('email', e.target.value)} required placeholder="example@email.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ref_phone">{t('referrals.phone')} *</Label>
              <Input id="ref_phone" type="tel" value={form.phone} onChange={e => updateField('phone', e.target.value)} required placeholder={t('referrals.phonePlaceholder')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ref_country">{t('referrals.country')}</Label>
              <Input id="ref_country" value={form.country} onChange={e => updateField('country', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ref_city">{t('referrals.city')}</Label>
              <Input id="ref_city" value={form.city} onChange={e => updateField('city', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ref_dob">{t('referrals.dob')}</Label>
              <Input id="ref_dob" type="date" value={form.dob} onChange={e => updateField('dob', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ref_gender">{t('referrals.gender')}</Label>
              <Select value={form.gender} onValueChange={v => updateField('gender', v)}>
                <SelectTrigger><SelectValue placeholder={t('referrals.selectGender')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">{t('referrals.male')}</SelectItem>
                  <SelectItem value="female">{t('referrals.female')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="ref_german">{t('referrals.germanLevel')}</Label>
              <Select value={form.german_level} onValueChange={v => updateField('german_level', v)}>
                <SelectTrigger><SelectValue placeholder={t('referrals.selectLevel')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('referrals.noLevel')}</SelectItem>
                  <SelectItem value="A1">A1</SelectItem>
                  <SelectItem value="A2">A2</SelectItem>
                  <SelectItem value="B1">B1</SelectItem>
                  <SelectItem value="B2">B2</SelectItem>
                  <SelectItem value="C1">C1</SelectItem>
                  <SelectItem value="C2">C2</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2 flex items-start gap-2 pt-2">
              <Checkbox id="terms" checked={termsAccepted} onCheckedChange={(v) => setTermsAccepted(v === true)} />
              <Label htmlFor="terms" className="text-sm cursor-pointer leading-relaxed">
                {t('referrals.termsLabel')}
              </Label>
            </div>

            <div className="md:col-span-2">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <UserPlus className="h-4 w-4 me-2" />}
                {t('referrals.submit')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <ReferralTracker userId={userId} />
    </div>
  );
};

export default ReferralForm;
