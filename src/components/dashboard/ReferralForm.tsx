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

interface ReferralFormProps {
  userId: string;
}

const ReferralForm: React.FC<ReferralFormProps> = ({ userId }) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isFamily, setIsFamily] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [form, setForm] = useState({
    first_name: '',
    surname: '',
    email: '',
    phone: '',
    country: '',
    city: '',
    dob: '',
    gender: '',
    german_level: '',
  });

  const updateField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAccepted) {
      toast({ variant: 'destructive', title: 'يرجى الموافقة على الشروط والأحكام' });
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await (supabase as any).from('referrals').insert({
        referrer_id: userId,
        referrer_type: 'student',
        referred_name: `${form.first_name} ${form.surname}`.trim(),
        referred_email: form.email || null,
        referred_phone: form.phone || null,
        referred_country: form.country || null,
        referred_city: form.city || null,
        referred_dob: form.dob || null,
        referred_gender: form.gender || null,
        referred_german_level: form.german_level || null,
        is_family: isFamily,
        status: 'pending',
        terms_accepted_at: new Date().toISOString(),
      });
      if (error) throw error;
      toast({ title: 'تم إرسال الإحالة بنجاح! ✨' });
      setForm({ first_name: '', surname: '', email: '', phone: '', country: '', city: '', dob: '', gender: '', german_level: '' });
      setIsFamily(false);
      setTermsAccepted(false);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'خطأ', description: err.message });
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
            إحالة صديق أو أحد أفراد العائلة
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Family toggle */}
          <div className="flex items-center gap-3 mb-6 p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <Checkbox
                id="isFamily"
                checked={isFamily}
                onCheckedChange={(v) => setIsFamily(v === true)}
              />
              <Label htmlFor="isFamily" className="flex items-center gap-1 cursor-pointer">
                <Users className="h-4 w-4" />
                إحالة فرد من العائلة (خصم 1,000₪ للمُحال)
              </Label>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">الاسم الأول *</Label>
              <Input id="first_name" value={form.first_name} onChange={e => updateField('first_name', e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="surname">اسم العائلة *</Label>
              <Input id="surname" value={form.surname} onChange={e => updateField('surname', e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ref_email">البريد الإلكتروني</Label>
              <Input id="ref_email" type="email" value={form.email} onChange={e => updateField('email', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ref_phone">الهاتف</Label>
              <Input id="ref_phone" type="tel" value={form.phone} onChange={e => updateField('phone', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ref_country">البلد / الجنسية</Label>
              <Input id="ref_country" value={form.country} onChange={e => updateField('country', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ref_city">المدينة</Label>
              <Input id="ref_city" value={form.city} onChange={e => updateField('city', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ref_dob">تاريخ الميلاد</Label>
              <Input id="ref_dob" type="date" value={form.dob} onChange={e => updateField('dob', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ref_gender">الجنس</Label>
              <Select value={form.gender} onValueChange={v => updateField('gender', v)}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">ذكر</SelectItem>
                  <SelectItem value="female">أنثى</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="ref_german">مستوى اللغة الألمانية الحالي</Label>
              <Select value={form.german_level} onValueChange={v => updateField('german_level', v)}>
                <SelectTrigger><SelectValue placeholder="اختر المستوى" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">لا يوجد</SelectItem>
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
              <Checkbox
                id="terms"
                checked={termsAccepted}
                onCheckedChange={(v) => setTermsAccepted(v === true)}
              />
              <Label htmlFor="terms" className="text-sm cursor-pointer leading-relaxed">
                أؤكد أن جميع المعلومات المقدمة صحيحة وأوافق على الشروط والأحكام
              </Label>
            </div>

            <div className="md:col-span-2">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <UserPlus className="h-4 w-4 me-2" />}
                إرسال الإحالة
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
