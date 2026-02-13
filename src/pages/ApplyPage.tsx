
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, ChevronLeft, ChevronRight, GraduationCap, Shield, Headphones } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useDirection } from '@/hooks/useDirection';

const PASSPORT_TYPES = [
  { value: 'israeli_blue', label: 'جواز أزرق (إسرائيلي)', labelEn: 'Israeli Blue Passport' },
  { value: 'israeli_red', label: 'جواز أحمر (لم الشمل)', labelEn: 'Israeli Red Passport' },
  { value: 'other', label: 'أخرى', labelEn: 'Other' },
];

const EDUCATION_LEVELS = [
  { value: 'bagrut', label: 'بجروت / ثانوية', labelEn: 'Bagrut / High School' },
  { value: 'bachelor', label: 'بكالوريوس', labelEn: 'Bachelor' },
  { value: 'master', label: 'ماجستير', labelEn: 'Master' },
];

const GERMAN_LEVELS = [
  { value: 'beginner', label: 'مبتدئ', labelEn: 'Beginner' },
  { value: 'intermediate', label: 'متوسط', labelEn: 'Intermediate' },
  { value: 'advanced', label: 'متقدم', labelEn: 'Advanced' },
];

const ApplyPage: React.FC = () => {
  const { t, i18n } = useTranslation('landing');
  const { dir, isRtl } = useDirection();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const isAr = i18n.language === 'ar';

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

  if (submitted) {
    return (
      <div className={`min-h-screen flex flex-col ${isDark ? 'dark' : ''}`} dir={dir}>
        <div className="min-h-screen flex flex-col bg-background text-foreground">
          <ApplyTopBar />
          <main className="flex-1 flex items-center justify-center p-4">
            <div className="w-full max-w-md text-center space-y-6 animate-fade-in">
              <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
                {/* Pulse rings */}
                <span className="absolute inset-0 rounded-full bg-green-400/20 animate-[ping_1.5s_ease-out_infinite]" />
                <span className="absolute inset-2 rounded-full bg-green-400/15 animate-[ping_1.5s_ease-out_0.3s_infinite]" />
                <div className="relative w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center animate-scale-in">
                  <CheckCircle className="h-10 w-10 text-green-500" />
                </div>
              </div>
              <h2 className="text-2xl font-bold">{t('apply.successTitle', 'تم استلام بياناتك ✅')}</h2>
              <p className="text-muted-foreground">{t('apply.successSubtitle', 'سيتم التواصل معك عبر واتساب قريباً')}</p>
              <p className="text-sm text-muted-foreground/70">{t('apply.whileYouWait', 'في هذه الأثناء، تصفّح خدماتنا واكتشف المزيد')}</p>
              <a href="/">
                <Button className="h-12 px-8 rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground text-base font-semibold mt-2">
                  {t('apply.exploreWebsite', 'تصفّح موقعنا')}
                </Button>
              </a>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const stepTitles = [
    t('apply.stepTitle1', 'المعلومات الشخصية'),
    t('apply.stepTitle2', 'الخلفية التعليمية'),
    t('apply.stepTitle3', 'اللغة الألمانية'),
  ];

  return (
    <div className={`min-h-screen flex flex-col ${isDark ? 'dark' : ''}`} dir={dir}>
      <div className="min-h-screen flex flex-col bg-background text-foreground">
        <ApplyTopBar />

        <main className="flex-1 flex flex-col items-center px-4 py-6 md:py-10 gap-6 max-w-lg mx-auto w-full">
          {/* Hero */}
          <section className="text-center space-y-2 animate-fade-in">
            <h1 className="text-xl md:text-2xl font-bold leading-tight">
              {t('apply.heroTitle', 'ابدأ رحلتك للدراسة في ألمانيا 🇩🇪')}
            </h1>
            <p className="text-muted-foreground text-sm">
              {t('apply.heroSubtitle', 'املأ البيانات وسنتواصل معك قريباً')}
            </p>
          </section>

          {/* Step Indicators */}
          <div className="w-full flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                    s < step
                      ? 'bg-accent text-accent-foreground'
                      : s === step
                      ? 'bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2 ring-offset-background'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {s < step ? <CheckCircle className="h-4 w-4" /> : s}
                </div>
                <span className="text-[10px] text-muted-foreground text-center leading-tight hidden sm:block">
                  {stepTitles[s - 1]}
                </span>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <Progress value={progressValue} className="h-1.5 w-full" />

          {/* Form */}
          <div className="w-full bg-card border border-border rounded-2xl shadow-sm overflow-hidden animate-fade-in">
            <div className="px-5 py-4 border-b border-border bg-muted/30">
              <h2 className="text-sm font-semibold">{stepTitles[step - 1]}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('apply.step', 'خطوة')} {step} / 3
              </p>
            </div>

            <div className="p-5 space-y-5">
              {/* Step 1 */}
              {step === 1 && (
                <div className="space-y-4 animate-fade-in">
                  <FieldGroup label={t('apply.fullName', 'الاسم الكامل')}>
                    <Input
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      placeholder={t('apply.fullNamePlaceholder', 'أدخل اسمك الكامل')}
                      dir={dir}
                      className="h-11"
                    />
                  </FieldGroup>
                  <FieldGroup label={t('apply.phone', 'رقم الهاتف / واتساب')}>
                    <Input
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="05X-XXXXXXX"
                      dir="ltr"
                      type="tel"
                      className="h-11"
                    />
                  </FieldGroup>
                </div>
              )}

              {/* Step 2 */}
              {step === 2 && (
                <div className="space-y-4 animate-fade-in">
                  <FieldGroup label={t('apply.passportType', 'نوع جواز السفر')}>
                    <div className="grid grid-cols-1 gap-2">
                      {PASSPORT_TYPES.map(pt => (
                        <button
                          key={pt.value}
                          type="button"
                          onClick={() => setPassportType(pt.value)}
                          className={`w-full text-start px-4 py-2.5 rounded-xl border text-sm font-medium transition-all duration-200 ${
                            passportType === pt.value
                              ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                              : 'bg-card border-border hover:border-primary/40 hover:bg-muted/50'
                          }`}
                        >
                          {isAr ? pt.label : pt.labelEn}
                        </button>
                      ))}
                    </div>
                  </FieldGroup>
                  <div className="grid grid-cols-2 gap-3">
                    <FieldGroup label={t('apply.englishUnits', 'وحدات الإنجليزي')}>
                      <Input
                        type="number"
                        min="1"
                        max="5"
                        value={englishUnits}
                        onChange={e => setEnglishUnits(e.target.value)}
                        placeholder="3-5"
                        dir="ltr"
                        className="h-11"
                      />
                    </FieldGroup>
                    <FieldGroup label={t('apply.mathUnits', 'وحدات الرياضيات')}>
                      <Input
                        type="number"
                        min="1"
                        max="5"
                        value={mathUnits}
                        onChange={e => setMathUnits(e.target.value)}
                        placeholder="3-5"
                        dir="ltr"
                        className="h-11"
                      />
                    </FieldGroup>
                  </div>
                  <FieldGroup label={t('apply.educationLevel', 'المستوى التعليمي')}>
                    <div className="grid grid-cols-3 gap-2">
                      {EDUCATION_LEVELS.map(lvl => (
                        <button
                          key={lvl.value}
                          type="button"
                          onClick={() => setEducationLevel(lvl.value)}
                          className={`px-3 py-2.5 rounded-xl border text-xs font-medium transition-all duration-200 ${
                            educationLevel === lvl.value
                              ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                              : 'bg-card border-border hover:border-primary/40 hover:bg-muted/50'
                          }`}
                        >
                          {isAr ? lvl.label : lvl.labelEn}
                        </button>
                      ))}
                    </div>
                  </FieldGroup>
                </div>
              )}

              {/* Step 3 */}
              {step === 3 && (
                <div className="space-y-4 animate-fade-in">
                  <FieldGroup label={t('apply.germanLevel', 'مستوى اللغة الألمانية')}>
                    <div className="grid grid-cols-3 gap-2">
                      {GERMAN_LEVELS.map(lvl => (
                        <button
                          key={lvl.value}
                          type="button"
                          onClick={() => setGermanLevel(lvl.value)}
                          className={`px-3 py-3 rounded-xl border text-sm font-medium transition-all duration-200 ${
                            germanLevel === lvl.value
                              ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                              : 'bg-card border-border hover:border-primary/40 hover:bg-muted/50'
                          }`}
                        >
                          {isAr ? lvl.label : lvl.labelEn}
                        </button>
                      ))}
                    </div>
                  </FieldGroup>
                </div>
              )}

              {/* Navigation */}
              <div className="flex gap-3 pt-2">
                {step > 1 && (
                  <Button variant="outline" className="flex-1 h-11 rounded-xl" onClick={() => setStep(s => s - 1)}>
                    <BackIcon className="h-4 w-4" />
                    {t('apply.back', 'رجوع')}
                  </Button>
                )}
                {step < 3 ? (
                  <Button
                    className="flex-1 h-11 rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground"
                    onClick={() => setStep(s => s + 1)}
                    disabled={!canGoNext()}
                  >
                    {t('apply.next', 'التالي')}
                    <NextIcon className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    className="flex-1 h-11 rounded-xl bg-accent hover:bg-accent/90 text-accent-foreground"
                    onClick={handleSubmit}
                    disabled={loading || !canGoNext()}
                  >
                    {loading ? '...' : t('apply.submit', 'أرسل بياناتي')}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Trust Badges */}
          <div className="grid grid-cols-3 gap-2.5 w-full">
            {[
              { icon: GraduationCap, label: t('apply.trustBadge1', 'استشارة مجانية') },
              { icon: Shield, label: t('apply.trustBadge2', 'مدارس معتمدة') },
              { icon: Headphones, label: t('apply.trustBadge3', 'متابعة حتى التسجيل') },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex flex-col items-center gap-1.5 text-center p-3 rounded-xl border border-border bg-card text-xs text-muted-foreground"
              >
                <Icon className="h-5 w-5 text-accent" />
                <span className="leading-tight">{label}</span>
              </div>
            ))}
          </div>

          {/* Footer text */}
          <p className="text-[11px] text-muted-foreground/60 text-center pb-4">
            Darb Study International © {new Date().getFullYear()}
          </p>
        </main>
      </div>
    </div>
  );
};

const FieldGroup = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-semibold text-foreground/80">{label}</label>
    {children}
  </div>
);

const ApplyTopBar = () => (
  <header className="h-3 bg-gradient-to-r from-primary via-accent to-primary" />
);

export default ApplyPage;
