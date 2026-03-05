import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, Gift } from 'lucide-react';
import ReferralTracker from './ReferralTracker';
import { useTranslation } from 'react-i18next';

interface ReferralFormProps {
  userId: string;
}

const ReferralForm: React.FC<ReferralFormProps> = ({ userId }) => {
  const { toast } = useToast();
  const { t } = useTranslation('dashboard');
  const [isLoading, setIsLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [form, setForm] = useState({ referred_name: '', referred_phone: '' });

  const updateField = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAccepted) {
      toast({ variant: 'destructive', title: t('referrals.termsError') });
      return;
    }
    if (!form.referred_name.trim()) {
      toast({ variant: 'destructive', title: t('common.error', 'Error'), description: t('referrals.nameRequired', 'Name is required') });
      return;
    }
    const phoneRegex = /^\+?\d{7,15}$/;
    if (!phoneRegex.test(form.referred_phone.replace(/[\s\-()]/g, ''))) {
      toast({ variant: 'destructive', title: t('referrals.phoneError'), description: t('referrals.phoneErrorDesc') });
      return;
    }

    // Duplicate check by phone for this referrer
    const { data: existingByPhone } = await (supabase as any)
      .from('referrals')
      .select('id')
      .eq('referred_phone', form.referred_phone.trim())
      .eq('referrer_user_id', userId);

    if (existingByPhone?.length) {
      toast({ variant: 'destructive', title: t('referrals.duplicateError') });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await (supabase as any).from('referrals').insert({
        referrer_user_id: userId,
        referred_name: form.referred_name.trim(),
        referred_phone: form.referred_phone.trim(),
        discount_applied: false,
      });
      if (error) throw error;

      // Also create a case via edge function for the referred person
      try {
        await supabase.functions.invoke('create-case-from-apply', {
          body: {
            full_name: form.referred_name.trim(),
            phone_number: form.referred_phone.trim(),
            source: 'apply_page',
          },
        });
      } catch (caseErr) {
        console.warn('Auto-case creation for referral failed (non-blocking):', caseErr);
      }

      toast({ title: t('referrals.success') });
      setForm({ referred_name: '', referred_phone: '' });
      setTermsAccepted(false);
    } catch (err: any) {
      toast({ variant: 'destructive', title: t('common.error', 'Error'), description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Discount info banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
        <Gift className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <p className="text-sm text-foreground">
          {t('student.refer.discount_message', 'Referring a friend or family member will give them a 500 shekel discount on their registration.')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            {t('referrals.title', 'Refer a Friend or Family Member')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="referred_name">{t('referrals.firstName', 'Full Name')} *</Label>
              <Input
                id="referred_name"
                value={form.referred_name}
                onChange={e => updateField('referred_name', e.target.value)}
                required
                placeholder={t('referrals.namePlaceholder', 'Friend\'s full name')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="referred_phone">{t('referrals.phone', 'Phone (with country code)')} *</Label>
              <Input
                id="referred_phone"
                type="tel"
                value={form.referred_phone}
                onChange={e => updateField('referred_phone', e.target.value)}
                required
                placeholder={t('referrals.phonePlaceholder', '+972 52 XXX XXXX')}
                dir="ltr"
              />
            </div>

            <div className="flex items-start gap-2 pt-2">
              <Checkbox
                id="terms"
                checked={termsAccepted}
                onCheckedChange={(v) => setTermsAccepted(v === true)}
              />
              <Label htmlFor="terms" className="text-sm cursor-pointer leading-relaxed">
                {t('referrals.termsLabel', 'I confirm that all information provided is correct and I agree to the terms and conditions')}
              </Label>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading
                ? <Loader2 className="h-4 w-4 animate-spin me-2" />
                : <UserPlus className="h-4 w-4 me-2" />
              }
              {t('referrals.submit', 'Submit Referral')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <ReferralTracker userId={userId} />
    </div>
  );
};

export default ReferralForm;
