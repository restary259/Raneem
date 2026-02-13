
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, ChevronLeft, ChevronRight, GraduationCap, Shield, Headphones } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useDirection } from '@/hooks/useDirection';

const PASSPORT_TYPES = [
  { value: 'israeli_blue', label: 'جواز أزرق (إسرائيلي)' },
  { value: 'israeli_red', label: 'جواز أحمر (لم الشمل)' },
  { value: 'other', label: 'أخرى' },
];

const EDUCATION_LEVELS = [
  { value: 'bagrut', label: 'بجروت / ثانوية' },
  { value: 'bachelor', label: 'بكالوريوس' },
  { value: 'master', label: 'ماجستير' },
];

const GERMAN_LEVELS = [
  { value: 'beginner', label: 'مبتدئ' },
  { value: 'intermediate', label: 'متوسط' },
  { value: 'advanced', label: 'متقدم' },
];

const ApplyPage: React.FC = () => {
  const { t } = useTranslation('landing');
  const { dir, isRtl } = useDirection();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  // Step 1
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  // Step 2
  const [passportType, setPassportType] = useState('');
  const [englishUnits, setEnglishUnits] = useState('');
  const [mathUnits, setMathUnits] = useState('');
  const [educationLevel, setEducationLevel] = useState('');

  // Step 3
  const [germanLevel, setGermanLevel] = useState('');

  // Referral
  const [sourceType, setSourceType] = useState('organic');
  const [sourceId, setSourceId] = useState<string | null>(null);

  // Auto dark mode based on time
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const hour = new Date().getHours();
    setIsDark(hour >= 19 || hour < 6);
  }, []);

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      supabase
        .from('user_roles')
        .select('user_id')
        .eq('user_id', ref)
        .eq('role', 'influencer')
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setSourceType('influencer');
            setSourceId(ref);
          }
        });
    }
  }, [searchParams]);

  const canGoNext = () => {
    if (step === 1) return fullName.trim().length > 0 && phone.trim().length > 0;
    return true;
  };

  const handleSubmit = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const { error } = await supabase.rpc('insert_lead_from_apply', {
        p_full_name: fullName.trim(),
        p_phone: phone.trim(),
        p_passport_type: passportType || null,
        p_english_units: englishUnits ? parseInt(englishUnits) : null,
        p_math_units: mathUnits ? parseInt(mathUnits) : null,
        p_education_level: educationLevel || null,
        p_german_level: germanLevel || null,
        p_source_type: sourceType,
        p_source_id: sourceId,
      } as any);
      if (error) throw error;
      setSubmitted(true);
    } catch {
      toast({ title: t('apply.error', 'حدث خطأ، حاول مرة أخرى'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const progressValue = (step / 3) * 100;
  const NextIcon = isRtl ? ChevronLeft : ChevronRight;
  const BackIcon = isRtl ? ChevronRight : ChevronLeft;

  const bgClass = isDark ? 'bg-[hsl(222,47%,11%)] text-white' : 'bg-[hsl(210,40%,98%)]';
  const cardClass = isDark ? 'bg-[hsl(222,47%,15%)] border-white/10' : '';

  if (submitted) {
    return (
      <div className={`min-h-screen flex flex-col ${bgClass}`} dir={dir}>
        <TopBar />
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className={`w-full max-w-md text-center p-8 ${cardClass}`}>
            <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">{t('apply.successTitle', 'تم استلام بياناتك ✅')}</h2>
            <p className="text-muted-foreground">{t('apply.successSubtitle', 'سيتم التواصل معك عبر واتساب قريباً')}</p>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col ${bgClass}`} dir={dir}>
      <TopBar />

      <main className="flex-1 flex flex-col items-center px-4 py-8 gap-6 max-w-lg mx-auto w-full">
        {/* Hero */}
        <section className="text-center space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold">{t('apply.heroTitle', 'ابدأ رحلتك للدراسة في ألمانيا 🇩🇪')}</h1>
          <p className="text-muted-foreground text-sm md:text-base">{t('apply.heroSubtitle', 'املأ البيانات وسنتواصل معك قريباً')}</p>
        </section>

        {/* Form Card */}
        <Card className={`w-full ${cardClass}`}>
          <CardContent className="p-6 space-y-6">
            {/* Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t('apply.step', 'خطوة')} {step}/3</span>
              </div>
              <Progress value={progressValue} className="h-2" />
            </div>

            {/* Step 1: Personal Info */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('apply.fullName', 'الاسم الكامل')}</label>
                  <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder={t('apply.fullNamePlaceholder', 'أدخل اسمك الكامل')} dir={dir} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('apply.phone', 'رقم الهاتف / واتساب')}</label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="05X-XXXXXXX" dir="ltr" type="tel" />
                </div>
              </div>
            )}

            {/* Step 2: Background */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('apply.passportType', 'نوع جواز السفر')}</label>
                  <div className="grid grid-cols-1 gap-2">
                    {PASSPORT_TYPES.map(pt => (
                      <Button key={pt.value} type="button" variant={passportType === pt.value ? 'default' : 'outline'} size="sm" className="w-full justify-start" onClick={() => setPassportType(pt.value)}>
                        {pt.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('apply.englishUnits', 'عدد وحدات الإنجليزي')}</label>
                    <Input type="number" min="1" max="5" value={englishUnits} onChange={e => setEnglishUnits(e.target.value)} placeholder="3-5" dir="ltr" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">{t('apply.mathUnits', 'عدد وحدات الرياضيات')}</label>
                    <Input type="number" min="1" max="5" value={mathUnits} onChange={e => setMathUnits(e.target.value)} placeholder="3-5" dir="ltr" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('apply.educationLevel', 'المستوى التعليمي')}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {EDUCATION_LEVELS.map(lvl => (
                      <Button key={lvl.value} type="button" variant={educationLevel === lvl.value ? 'default' : 'outline'} size="sm" className="w-full text-xs" onClick={() => setEducationLevel(lvl.value)}>
                        {lvl.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: German Level */}
            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('apply.germanLevel', 'مستوى اللغة الألمانية')}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {GERMAN_LEVELS.map(lvl => (
                      <Button key={lvl.value} type="button" variant={germanLevel === lvl.value ? 'default' : 'outline'} size="sm" className="w-full" onClick={() => setGermanLevel(lvl.value)}>
                        {lvl.label}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-3">
              {step > 1 && (
                <Button variant="outline" className="flex-1" onClick={() => setStep(s => s - 1)}>
                  <BackIcon className="h-4 w-4" />
                  {t('apply.back', 'رجوع')}
                </Button>
              )}
              {step < 3 ? (
                <Button className="flex-1" onClick={() => setStep(s => s + 1)} disabled={!canGoNext()}>
                  {t('apply.next', 'التالي')}
                  <NextIcon className="h-4 w-4" />
                </Button>
              ) : (
                <Button className="flex-1" onClick={handleSubmit} disabled={loading || !canGoNext()}>
                  {loading ? '...' : t('apply.submit', 'أرسل بياناتي')}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Trust Badges */}
        <div className="grid grid-cols-3 gap-3 w-full">
          {[
            { icon: GraduationCap, label: t('apply.trustBadge1', 'استشارة مجانية') },
            { icon: Shield, label: t('apply.trustBadge2', 'مدارس معتمدة') },
            { icon: Headphones, label: t('apply.trustBadge3', 'متابعة حتى التسجيل') },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className={`flex flex-col items-center gap-1 text-center p-3 rounded-xl border text-xs text-muted-foreground ${cardClass || 'bg-card'}`}>
              <Icon className="h-5 w-5 text-primary" />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

const TopBar = () => (
  <header className="flex items-center justify-center py-4 px-4 border-b bg-card/80 backdrop-blur-sm">
    <img
      src="/lovable-uploads/fc80f423-4215-4afe-ab5f-60a784436ae5.png"
      alt="Darb Study"
      className="h-10 object-contain"
    />
  </header>
);

export default ApplyPage;
