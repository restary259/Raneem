
import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, ChevronLeft, ChevronRight, GraduationCap, Shield, Headphones, Search, MessageCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useDirection } from '@/hooks/useDirection';
import { majorsData } from '@/data/majorsData';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

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

const APPLYING_WITH_OPTIONS = [
  { value: 'alone', label: 'وحدي', labelEn: 'Alone' },
  { value: 'family', label: 'مع عائلتي', labelEn: 'With Family' },
  { value: 'friend', label: 'مع صديق', labelEn: 'With a Friend' },
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
  const [preferredMajor, setPreferredMajor] = useState('');
  const [majorSearchOpen, setMajorSearchOpen] = useState(false);

  // Applying With (replaces hasCompanion checkbox)
  const [applyingWith, setApplyingWith] = useState('alone');
  const [companionName, setCompanionName] = useState('');
  const [companionPhone, setCompanionPhone] = useState('');
  const [companionPassport, setCompanionPassport] = useState('');
  const [companionEnglish, setCompanionEnglish] = useState('');
  const [companionMath, setCompanionMath] = useState('');
  const [companionEducation, setCompanionEducation] = useState('');
  const [companionMajor, setCompanionMajor] = useState('');
  const [companionMajorSearchOpen, setCompanionMajorSearchOpen] = useState(false);

  // Referral
  const [sourceType, setSourceType] = useState('organic');
  const [sourceId, setSourceId] = useState<string | null>(null);

  // Flatten majors for typeahead
  const allMajors = useMemo(() => {
    return majorsData.flatMap(cat =>
      cat.subMajors.map(sub => ({
        id: sub.id,
        nameAR: sub.nameAR,
        nameEN: sub.nameEN,
        categoryAR: cat.title,
        categoryEN: cat.titleEN,
      }))
    );
  }, []);

  const getMajorLabel = (id: string) => {
    const m = allMajors.find(m => m.id === id);
    if (!m) return '';
    return isAr ? m.nameAR : m.nameEN;
  };

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

  // Phone validation
  const isValidPhone = (p: string) => {
    const cleaned = p.replace(/[\s\-()]/g, '');
    return /^05\d{8}$/.test(cleaned) || /^\+9725\d{8}$/.test(cleaned);
  };
  const [phoneError, setPhoneError] = useState('');

  const canGoNext = () => {
    if (step === 1) {
      if (!fullName.trim()) return false;
      if (!phone.trim()) return false;
      if (!isValidPhone(phone)) return false;
      return true;
    }
    return true;
  };

  const handlePhoneChange = (val: string) => {
    setPhone(val);
    if (val.trim() && !isValidPhone(val)) {
      setPhoneError(isAr ? 'رقم هاتف غير صالح (مثال: 0501234567)' : 'Invalid phone number (e.g. 0501234567)');
    } else {
      setPhoneError('');
    }
  };

  const hasCompanion = applyingWith === 'family' || applyingWith === 'friend';

  const handleSubmit = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const rpcParams: Record<string, any> = {
        p_full_name: fullName.trim(),
        p_phone: phone.trim(),
        p_passport_type: passportType || null,
        p_english_units: englishUnits ? parseInt(englishUnits) : null,
        p_math_units: mathUnits ? parseInt(mathUnits) : null,
        p_education_level: educationLevel || null,
        p_german_level: null,
        p_source_type: sourceType,
        p_source_id: sourceId,
        p_preferred_major: preferredMajor || null,
      };
      if (hasCompanion && companionName.trim() && companionPhone.trim()) {
        rpcParams.p_companion_name = companionName.trim();
        rpcParams.p_companion_phone = companionPhone.trim();
      }
      const { error } = await supabase.rpc('insert_lead_from_apply', rpcParams as any);
      if (error) throw error;

      // If companion has full data, submit separate lead
      if (hasCompanion && companionName.trim() && companionPhone.trim()) {
        const companionParams: Record<string, any> = {
          p_full_name: companionName.trim(),
          p_phone: companionPhone.trim(),
          p_passport_type: companionPassport || null,
          p_english_units: companionEnglish ? parseInt(companionEnglish) : null,
          p_math_units: companionMath ? parseInt(companionMath) : null,
          p_education_level: companionEducation || null,
          p_german_level: null,
          p_source_type: sourceType,
          p_source_id: sourceId,
          p_preferred_major: companionMajor || null,
        };
        await supabase.rpc('insert_lead_from_apply', companionParams as any);
      }

      setSubmitted(true);
    } catch {
      toast({ title: t('apply.error', 'حدث خطأ، حاول مرة أخرى'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const TOTAL_STEPS = 2;
  const progressValue = (step / TOTAL_STEPS) * 100;
  const NextIcon = isRtl ? ChevronLeft : ChevronRight;
  const BackIcon = isRtl ? ChevronRight : ChevronLeft;

  // Enhanced success screen
  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col" dir={dir}>
        <div className="min-h-screen flex flex-col bg-background text-foreground">
          <ApplyTopBar />
          <main className="flex-1 flex items-center justify-center p-4">
            <div className="w-full max-w-md text-center space-y-6 animate-fade-in">
              <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-green-400/20 animate-[ping_1.5s_ease-out_infinite]" />
                <span className="absolute inset-2 rounded-full bg-green-400/15 animate-[ping_1.5s_ease-out_0.3s_infinite]" />
                <div className="relative w-20 h-20 rounded-full bg-green-100 flex items-center justify-center animate-scale-in">
                  <CheckCircle className="h-10 w-10 text-green-500" />
                </div>
              </div>
              <h2 className="text-2xl font-bold">{t('apply.successTitle', 'تم استلام بياناتك ✅')}</h2>
              <p className="text-muted-foreground">{t('apply.successSubtitle', 'سيتم التواصل معك عبر واتساب قريباً')}</p>
              
              {/* Expected contact time */}
              <div className="bg-muted/40 border border-border rounded-xl p-4 space-y-2">
                <p className="text-sm font-semibold text-foreground">
                  {isAr ? '⏰ سنتواصل معك خلال 24 ساعة عبر واتساب' : '⏰ We will contact you within 24 hours via WhatsApp'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isAr ? 'في حال لديك استفسار عاجل، تواصل معنا مباشرة:' : 'For urgent questions, reach us directly:'}
                </p>
                <a
                  href="https://wa.me/972549110735"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-medium transition-colors"
                >
                  <MessageCircle className="h-4 w-4" />
                  {isAr ? 'واتساب درب' : 'WhatsApp Darb'}
                </a>
              </div>

              {sourceId && (
                <p className="text-xs text-muted-foreground/60">
                  {isAr ? `كود المصدر: ${sourceId.slice(0, 8)}...` : `Ref: ${sourceId.slice(0, 8)}...`}
                </p>
              )}

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
  ];

  const MajorTypeahead = ({ value, onChange, open, onOpenChange }: { value: string; onChange: (v: string) => void; open: boolean; onOpenChange: (o: boolean) => void }) => (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full h-11 justify-between text-sm font-normal rounded-xl"
        >
          {value ? getMajorLabel(value) : (isAr ? 'اختر التخصص...' : 'Select a major...')}
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command dir={dir}>
          <CommandInput placeholder={isAr ? 'ابحث عن تخصص...' : 'Search majors...'} />
          <CommandList>
            <CommandEmpty>{isAr ? 'لا توجد نتائج' : 'No results found'}</CommandEmpty>
            {majorsData.map(cat => (
              <CommandGroup key={cat.id} heading={isAr ? cat.title : cat.titleEN}>
                {cat.subMajors.map(sub => (
                  <CommandItem
                    key={sub.id}
                    value={`${sub.nameAR} ${sub.nameEN}`}
                    onSelect={() => {
                      onChange(sub.id);
                      onOpenChange(false);
                    }}
                  >
                    {isAr ? sub.nameAR : sub.nameEN}
                    {value === sub.id && <CheckCircle className="ml-auto h-4 w-4 text-primary" />}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );

  return (
    <div className="min-h-screen flex flex-col" dir={dir}>
      <div className="min-h-screen flex flex-col bg-background text-foreground">
        <ApplyTopBar />

        <main className="flex-1 flex flex-col items-center px-4 py-6 md:py-10 gap-6 max-w-lg mx-auto w-full">
          {/* Hero */}
          <section className="text-center space-y-2 animate-fade-in">
            <h1 className="text-xl md:text-2xl font-bold leading-tight">
              {t('apply.heroTitle')}
            </h1>
            <p className="text-muted-foreground text-sm">
              {t('apply.heroSubtitle')}
            </p>
          </section>

          {/* Step Indicators — 2 steps */}
          <div className="w-full flex items-center gap-2">
            {[1, 2].map((s) => (
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
                {t('apply.step', 'خطوة')} {step} / {TOTAL_STEPS}
              </p>
            </div>

            <div className="p-5 space-y-5">
              {/* Step 1: Personal Info */}
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
                      onChange={e => handlePhoneChange(e.target.value)}
                      placeholder="05X-XXXXXXX"
                      dir="ltr"
                      type="tel"
                      className={`h-11 ${phoneError ? 'border-red-500' : ''}`}
                    />
                    {phoneError && <p className="text-xs text-red-500 mt-1">{phoneError}</p>}
                  </FieldGroup>
                </div>
              )}

              {/* Step 2: Education + Major + Applying With + Companion */}
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
                        type="number" min="1" max="5"
                        value={englishUnits}
                        onChange={e => setEnglishUnits(e.target.value)}
                        placeholder="3-5" dir="ltr" className="h-11"
                      />
                    </FieldGroup>
                    <FieldGroup label={t('apply.mathUnits', 'وحدات الرياضيات')}>
                      <Input
                        type="number" min="1" max="5"
                        value={mathUnits}
                        onChange={e => setMathUnits(e.target.value)}
                        placeholder="3-5" dir="ltr" className="h-11"
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

                  {/* Major Typeahead */}
                  <FieldGroup label={t('apply.preferredMajor', isAr ? 'التخصص المفضل (اختياري)' : 'Preferred Major (optional)')}>
                    <MajorTypeahead
                      value={preferredMajor}
                      onChange={setPreferredMajor}
                      open={majorSearchOpen}
                      onOpenChange={setMajorSearchOpen}
                    />
                  </FieldGroup>

                  {/* Applying With — radio group (replaces companion checkbox) */}
                  <div className="pt-3 border-t border-border space-y-3">
                    <FieldGroup label={isAr ? 'هل تتقدم بمفردك أم مع شخص آخر؟' : 'Are you applying alone or with someone?'}>
                      <div className="grid grid-cols-3 gap-2">
                        {APPLYING_WITH_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setApplyingWith(opt.value)}
                            className={`px-3 py-2.5 rounded-xl border text-xs font-medium transition-all duration-200 ${
                              applyingWith === opt.value
                                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                : 'bg-card border-border hover:border-primary/40 hover:bg-muted/50'
                            }`}
                          >
                            {isAr ? opt.label : opt.labelEn}
                          </button>
                        ))}
                      </div>
                    </FieldGroup>

                    {/* Value positioning copy for family/friend */}
                    {hasCompanion && (
                      <div className="bg-accent/10 border border-accent/20 rounded-xl p-3 text-xs text-foreground/80">
                        <p className="font-semibold text-accent">
                          {applyingWith === 'family'
                            ? (isAr ? '🎓 ميزة التقديم العائلي' : '🎓 Family Application Benefit')
                            : (isAr ? '🎓 ميزة التقديم مع صديق' : '🎓 Group Application Benefit')
                          }
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          {isAr
                            ? 'إرشاد مشترك ولوجستيات أسهل — رصيد ₪500 لكل متقدم عند التقديم معاً'
                            : 'Shared guidance & smoother logistics — ₪500 credit per co-applicant when applying together'
                          }
                        </p>
                      </div>
                    )}

                    {/* Companion fields */}
                    {hasCompanion && (
                      <div className="space-y-4 p-4 rounded-xl bg-muted/30 border border-border animate-fade-in">
                        <p className="text-xs font-semibold text-foreground/70">
                          {t('apply.companionInfo', 'بيانات الشخص المرافق')}
                        </p>
                        <FieldGroup label={t('apply.companionName', 'اسم المرافق')}>
                          <Input value={companionName} onChange={e => setCompanionName(e.target.value)}
                            placeholder={t('apply.companionNamePlaceholder', 'الاسم الكامل للمرافق')} dir={dir} className="h-11" />
                        </FieldGroup>
                        <FieldGroup label={t('apply.companionPhone', 'هاتف المرافق')}>
                          <Input value={companionPhone} onChange={e => setCompanionPhone(e.target.value)}
                            placeholder="05X-XXXXXXX" dir="ltr" type="tel" className="h-11" />
                        </FieldGroup>

                        <FieldGroup label={t('apply.passportType', 'نوع جواز السفر')}>
                          <div className="grid grid-cols-1 gap-2">
                            {PASSPORT_TYPES.map(pt => (
                              <button key={pt.value} type="button" onClick={() => setCompanionPassport(pt.value)}
                                className={`w-full text-start px-4 py-2.5 rounded-xl border text-sm font-medium transition-all duration-200 ${
                                  companionPassport === pt.value
                                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                    : 'bg-card border-border hover:border-primary/40 hover:bg-muted/50'
                                }`}>
                                {isAr ? pt.label : pt.labelEn}
                              </button>
                            ))}
                          </div>
                        </FieldGroup>

                        <div className="grid grid-cols-2 gap-3">
                          <FieldGroup label={t('apply.englishUnits', 'وحدات الإنجليزي')}>
                            <Input type="number" min="1" max="5" value={companionEnglish}
                              onChange={e => setCompanionEnglish(e.target.value)} placeholder="3-5" dir="ltr" className="h-11" />
                          </FieldGroup>
                          <FieldGroup label={t('apply.mathUnits', 'وحدات الرياضيات')}>
                            <Input type="number" min="1" max="5" value={companionMath}
                              onChange={e => setCompanionMath(e.target.value)} placeholder="3-5" dir="ltr" className="h-11" />
                          </FieldGroup>
                        </div>

                        <FieldGroup label={t('apply.educationLevel', 'المستوى التعليمي')}>
                          <div className="grid grid-cols-3 gap-2">
                            {EDUCATION_LEVELS.map(lvl => (
                              <button key={lvl.value} type="button" onClick={() => setCompanionEducation(lvl.value)}
                                className={`px-3 py-2.5 rounded-xl border text-xs font-medium transition-all duration-200 ${
                                  companionEducation === lvl.value
                                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                    : 'bg-card border-border hover:border-primary/40 hover:bg-muted/50'
                                }`}>
                                {isAr ? lvl.label : lvl.labelEn}
                              </button>
                            ))}
                          </div>
                        </FieldGroup>

                        <FieldGroup label={t('apply.preferredMajor', isAr ? 'التخصص المفضل (اختياري)' : 'Preferred Major (optional)')}>
                          <MajorTypeahead
                            value={companionMajor}
                            onChange={setCompanionMajor}
                            open={companionMajorSearchOpen}
                            onOpenChange={setCompanionMajorSearchOpen}
                          />
                        </FieldGroup>
                      </div>
                    )}
                  </div>
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
                {step < TOTAL_STEPS ? (
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
