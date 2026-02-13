
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, MessageCircle, ChevronLeft, ChevronRight, GraduationCap, Shield, Headphones } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useDirection } from '@/hooks/useDirection';

const EDUCATION_LEVELS = ['ثانوية', 'بكالوريوس', 'ماجستير'];
const GERMAN_LEVELS = ['لا يوجد', 'A1', 'A2', 'B1', 'B2', 'C1'];
const BUDGET_RANGES = ['أقل من 5,000€', '5,000€ - 10,000€', '10,000€ - 15,000€', 'أكثر من 15,000€'];
const PREFERRED_CITIES = ['Berlin', 'Munich', 'Hamburg', 'Frankfurt', 'أخرى'];

const ApplyPage: React.FC = () => {
  const { t, i18n } = useTranslation('landing');
  const { dir, isRtl } = useDirection();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [educationLevel, setEducationLevel] = useState('');
  const [germanLevel, setGermanLevel] = useState('');
  const [budgetRange, setBudgetRange] = useState('');
  const [preferredCity, setPreferredCity] = useState('');
  const [accommodation, setAccommodation] = useState(false);

  // Resolve referral
  const [sourceType, setSourceType] = useState('organic');
  const [sourceId, setSourceId] = useState<string | null>(null);

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
    if (step === 2) return true;
    return true;
  };

  const handleSubmit = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const { error } = await supabase.rpc('insert_lead_from_apply', {
        p_full_name: fullName.trim(),
        p_phone: phone.trim(),
        p_city: city.trim() || null,
        p_education_level: educationLevel || null,
        p_german_level: germanLevel || null,
        p_budget_range: budgetRange || null,
        p_preferred_city: preferredCity || null,
        p_accommodation: accommodation,
        p_source_type: sourceType,
        p_source_id: sourceId,
      });
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

  if (submitted) {
    return (
      <div className="min-h-screen bg-[hsl(210,40%,98%)] flex flex-col" dir={dir}>
        <TopBar />
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="w-full max-w-md text-center p-8">
            <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">{t('apply.successTitle', 'تم استلام بياناتك ✅')}</h2>
            <p className="text-muted-foreground">{t('apply.successSubtitle', 'سيتم التواصل معك عبر واتساب قريباً')}</p>
          </Card>
        </main>
        <WhatsAppFab />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(210,40%,98%)] flex flex-col" dir={dir}>
      <TopBar />

      <main className="flex-1 flex flex-col items-center px-4 py-8 gap-6 max-w-lg mx-auto w-full">
        {/* Hero */}
        <section className="text-center space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold">{t('apply.heroTitle', 'ابدأ رحلتك للدراسة في ألمانيا 🇩🇪')}</h1>
          <p className="text-muted-foreground text-sm md:text-base">{t('apply.heroSubtitle', 'املأ البيانات وسنتواصل معك عبر واتساب خلال وقت قصير')}</p>
        </section>

        {/* Form Card */}
        <Card className="w-full">
          <CardContent className="p-6 space-y-6">
            {/* Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{t('apply.step', 'خطوة')} {step}/3</span>
              </div>
              <Progress value={progressValue} className="h-2" />
            </div>

            {/* Step 1 */}
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

            {/* Step 2 */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('apply.city', 'المدينة (داخل 48)')}</label>
                  <Input value={city} onChange={e => setCity(e.target.value)} placeholder={t('apply.cityPlaceholder', 'مثال: حيفا')} dir={dir} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('apply.educationLevel', 'المستوى التعليمي')}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {EDUCATION_LEVELS.map(lvl => (
                      <Button key={lvl} type="button" variant={educationLevel === lvl ? 'default' : 'outline'} size="sm" className="w-full" onClick={() => setEducationLevel(lvl)}>
                        {lvl}
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('apply.germanLevel', 'مستوى اللغة الألمانية')}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {GERMAN_LEVELS.map(lvl => (
                      <Button key={lvl} type="button" variant={germanLevel === lvl ? 'default' : 'outline'} size="sm" className="w-full" onClick={() => setGermanLevel(lvl)}>
                        {lvl}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3 */}
            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('apply.budgetRange', 'الميزانية المتوقعة')}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {BUDGET_RANGES.map(b => (
                      <Button key={b} type="button" variant={budgetRange === b ? 'default' : 'outline'} size="sm" className="w-full text-xs" onClick={() => setBudgetRange(b)}>
                        {b}
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('apply.preferredCity', 'المدينة المفضلة في ألمانيا')}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {PREFERRED_CITIES.map(c => (
                      <Button key={c} type="button" variant={preferredCity === c ? 'default' : 'outline'} size="sm" className="w-full text-xs" onClick={() => setPreferredCity(c)}>
                        {c}
                      </Button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{t('apply.accommodation', 'تحتاج سكن؟')}</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" variant={accommodation ? 'default' : 'outline'} size="sm" onClick={() => setAccommodation(true)}>{t('apply.yes', 'نعم')}</Button>
                    <Button type="button" variant={!accommodation ? 'default' : 'outline'} size="sm" onClick={() => setAccommodation(false)}>{t('apply.no', 'لا')}</Button>
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
            <div key={label} className="flex flex-col items-center gap-1 text-center p-3 rounded-xl bg-card border text-xs text-muted-foreground">
              <Icon className="h-5 w-5 text-primary" />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </main>

      <WhatsAppFab />
    </div>
  );
};

const TopBar = () => (
  <header className="flex items-center justify-center py-4 px-4 border-b bg-card">
    <img
      src="/lovable-uploads/fc80f423-4215-4afe-ab5f-60a784436ae5.png"
      alt="Darb Study"
      className="h-10 object-contain"
    />
  </header>
);

const WhatsAppFab = () => (
  <a
    href="https://api.whatsapp.com/message/IVC4VCAEJ6TBD1"
    target="_blank"
    rel="noopener noreferrer"
    className="fixed bottom-6 right-6 z-50 bg-green-500 hover:bg-green-600 text-white rounded-full p-4 shadow-lg transition-transform hover:scale-110"
    title="راسلنا مباشرة"
  >
    <MessageCircle className="h-6 w-6" />
  </a>
);

export default ApplyPage;
