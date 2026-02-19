import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import Map from "./Map";
import OfficeLocations from "./OfficeLocations";
import { Instagram, Facebook, MessageCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDirection } from "@/hooks/useDirection";
import TikTokIcon from "../icons/TikTokIcon";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const PASSPORT_TYPES = [
  { value: 'israeli_blue', labelAr: 'جواز أزرق (إسرائيلي)', labelEn: 'Israeli Blue Passport' },
  { value: 'israeli_red', labelAr: 'جواز أحمر (لم الشمل)', labelEn: 'Israeli Red Passport' },
  { value: 'other', labelAr: 'أخرى', labelEn: 'Other' },
];

const EDUCATION_LEVELS = [
  { value: 'bagrut', labelAr: 'بجروت', labelEn: 'Bagrut' },
  { value: 'bachelor', labelAr: 'بكالوريوس', labelEn: 'Bachelor' },
  { value: 'master', labelAr: 'ماجستير', labelEn: 'Master' },
  { value: 'other', labelAr: 'أخرى', labelEn: 'Other' },
];

const UNIT_OPTIONS = ['3', '4', '5'];

const isValidPhone = (p: string) => {
  const cleaned = p.replace(/[\s\-()]/g, '');
  return /^05\d{8}$/.test(cleaned) ||
    /^\+9725\d{8}$/.test(cleaned) ||
    /^\+?\d{7,15}$/.test(cleaned);
};

const FieldGroup = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-semibold text-foreground/80">{label}</label>
    {children}
  </div>
);

const Contact = () => {
  const { t, i18n } = useTranslation(['contact', 'common']);
  const { dir } = useDirection();
  const isAr = i18n.language === 'ar';

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [passportType, setPassportType] = useState('');
  const [city, setCity] = useState('');
  const [educationLevel, setEducationLevel] = useState('');
  const [englishUnits, setEnglishUnits] = useState('');
  const [mathUnits, setMathUnits] = useState('');
  const [preferredMajor, setPreferredMajor] = useState('');
  const [honeypot, setHoneypot] = useState('');

  const showBagrut = educationLevel === 'bagrut';

  const handlePhoneChange = (val: string) => {
    setPhone(val);
    if (val.trim() && !isValidPhone(val)) {
      setPhoneError(isAr ? 'رقم هاتف غير صالح (مثال: 0501234567)' : 'Invalid phone (e.g. 0501234567)');
    } else {
      setPhoneError('');
    }
  };

  const canSubmit = fullName.trim() && phone.trim() && isValidPhone(phone);

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      if (honeypot) return { success: true };
      const { error } = await supabase.rpc('insert_lead_from_apply', {
        p_full_name: fullName.trim(),
        p_phone: phone.trim(),
        p_passport_type: passportType || null,
        p_city: city.trim() || null,
        p_education_level: educationLevel || null,
        p_german_level: 'beginner',
        p_preferred_city: city.trim() || null,
        p_accommodation: false,
        p_source_type: 'contact_form',
        p_english_units: englishUnits ? parseInt(englishUnits) : null,
        p_math_units: mathUnits ? parseInt(mathUnits) : null,
        p_preferred_major: preferredMajor.trim() || null,
      } as any);
      if (error) throw new Error(error.message);
      return { success: true };
    },
    onSuccess: () => {
      toast({
        title: isAr ? '✅ تم إرسال بياناتك بنجاح!' : '✅ Sent successfully!',
        description: isAr ? 'شكراً! سيتواصل معك فريقنا قريباً عبر واتساب.' : 'Thank you! Our team will contact you soon via WhatsApp.',
      });
      // Reset
      setFullName(''); setPhone(''); setPassportType(''); setCity('');
      setEducationLevel(''); setEnglishUnits(''); setMathUnits(''); setPreferredMajor('');
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: isAr ? 'حدث خطأ' : 'Error', description: error.message });
    },
  });

  return (
    <section id="contact" className="py-12 md:py-24 bg-secondary">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12 items-start">
          <div className={`lg:col-span-2 ${dir === 'rtl' ? 'text-right' : 'text-left'} p-4 sm:p-6 md:p-8 bg-background/80 border border-white/20 rounded-2xl shadow-2xl animate-scale-in`}>
            <div className={`text-center ${dir === 'rtl' ? 'md:text-right' : 'md:text-left'} max-w-2xl mb-8`}>
              <h2 className="text-3xl md:text-4xl font-bold">{t('contact.title')}</h2>
              <p className="mt-4 text-lg text-muted-foreground">{t('contact.subtitle')}</p>
            </div>

            <div className="space-y-5">
              {/* Name + Phone */}
              <div className="grid md:grid-cols-2 gap-4">
                <FieldGroup label={isAr ? 'الاسم الكامل *' : 'Full Name *'}>
                  <Input value={fullName} onChange={e => setFullName(e.target.value)}
                    placeholder={isAr ? 'أدخل اسمك الكامل' : 'Enter your full name'} dir={dir} className="h-11" />
                </FieldGroup>
                <FieldGroup label={isAr ? 'رقم الهاتف / واتساب *' : 'Phone / WhatsApp *'}>
                  <Input value={phone} onChange={e => handlePhoneChange(e.target.value)}
                    placeholder="05X-XXXXXXX" dir="ltr" type="tel"
                    className={`h-11 ${phoneError ? 'border-destructive' : ''}`} />
                  {phoneError && <p className="text-xs text-destructive mt-1">{phoneError}</p>}
                </FieldGroup>
              </div>

              {/* Passport Type */}
              <FieldGroup label={isAr ? 'نوع جواز السفر' : 'Passport Type'}>
                <div className="grid grid-cols-3 gap-2">
                  {PASSPORT_TYPES.map(pt => (
                    <button key={pt.value} type="button" onClick={() => setPassportType(pt.value)}
                      className={`px-3 py-2.5 rounded-xl border text-xs font-medium transition-all duration-200 ${
                        passportType === pt.value
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : 'bg-card border-border hover:border-primary/40 hover:bg-muted/50'
                      }`}>
                      {isAr ? pt.labelAr : pt.labelEn}
                    </button>
                  ))}
                </div>
              </FieldGroup>

              {/* City */}
              <FieldGroup label={isAr ? 'المدينة (اختياري)' : 'City (optional)'}>
                <Input value={city} onChange={e => setCity(e.target.value)}
                  placeholder={isAr ? 'مثال: حيفا' : 'e.g. Haifa'} dir={dir} className="h-11" />
              </FieldGroup>

              {/* Education Level */}
              <FieldGroup label={isAr ? 'المستوى التعليمي' : 'Education Level'}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {EDUCATION_LEVELS.map(lvl => (
                    <button key={lvl.value} type="button" onClick={() => {
                      setEducationLevel(lvl.value);
                      if (lvl.value !== 'bagrut') { setEnglishUnits(''); setMathUnits(''); }
                    }}
                      className={`px-3 py-2.5 rounded-xl border text-xs font-medium transition-all duration-200 ${
                        educationLevel === lvl.value
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : 'bg-card border-border hover:border-primary/40 hover:bg-muted/50'
                      }`}>
                      {isAr ? lvl.labelAr : lvl.labelEn}
                    </button>
                  ))}
                </div>
              </FieldGroup>

              {/* Bagrut Units — only for bagrut */}
              {showBagrut && (
                <div className="grid md:grid-cols-2 gap-4 p-4 rounded-xl bg-muted/30 border border-border animate-fade-in">
                  <FieldGroup label={isAr ? 'وحدات الإنجليزي' : 'English Units'}>
                    <div className="flex gap-2">
                      {UNIT_OPTIONS.map(u => (
                        <button key={u} type="button" onClick={() => setEnglishUnits(u)}
                          className={`flex-1 py-2.5 rounded-xl border text-sm font-bold transition-all ${
                            englishUnits === u ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:border-primary/40'
                          }`}>{u}</button>
                      ))}
                    </div>
                  </FieldGroup>
                  <FieldGroup label={isAr ? 'وحدات الرياضيات' : 'Math Units'}>
                    <div className="flex gap-2">
                      {UNIT_OPTIONS.map(u => (
                        <button key={u} type="button" onClick={() => setMathUnits(u)}
                          className={`flex-1 py-2.5 rounded-xl border text-sm font-bold transition-all ${
                            mathUnits === u ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:border-primary/40'
                          }`}>{u}</button>
                      ))}
                    </div>
                  </FieldGroup>
                </div>
              )}

              {/* Preferred Major */}
              <FieldGroup label={isAr ? 'التخصص المفضل (اختياري)' : 'Preferred Major (optional)'}>
                <Input value={preferredMajor} onChange={e => setPreferredMajor(e.target.value)}
                  placeholder={isAr ? 'مثال: هندسة، طب، تجارة...' : 'e.g. Engineering, Medicine, Business...'}
                  dir={dir} className="h-11" />
              </FieldGroup>

              {/* Honeypot */}
              <input type="text" name="website" value={honeypot} onChange={e => setHoneypot(e.target.value)}
                style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, width: 0 }}
                tabIndex={-1} autoComplete="off" aria-hidden="true" />

              <Button type="button" className="w-full font-bold h-12" size="lg" variant="default"
                disabled={isPending || !canSubmit}
                onClick={() => mutate()}>
                {isPending
                  ? (isAr ? 'جارٍ الإرسال...' : 'Sending...')
                  : (isAr ? 'أرسل الآن' : 'Send Now')}
              </Button>
            </div>
          </div>

          <div className="space-y-8">
            <OfficeLocations />
            <div className="bg-background/90 border border-white/20 p-6 rounded-2xl shadow-lg animate-fade-in">
              <h3 className="text-xl font-semibold mb-4 text-center">{t('contact.follow')}</h3>
              <div className="flex justify-center items-center gap-6">
                <a href="https://www.instagram.com/darb_studyingermany/" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-accent transition-colors"><Instagram className="h-7 w-7" /></a>
                <a href="https://www.tiktok.com/@darb_studyingrmany" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-accent transition-colors"><TikTokIcon className="h-7 w-7" /></a>
                <a href="https://www.facebook.com/people/درب-للدراسة-في-المانيا/61557861907067/" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-accent transition-colors"><Facebook className="h-7 w-7" /></a>
                <a href="https://api.whatsapp.com/message/IVC4VCAEJ6TBD1" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-accent transition-colors"><MessageCircle className="h-7 w-7" /></a>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16 md:mt-24 text-center">
          <h2 className="text-3xl md:text-4xl font-bold">{t('contact.mapTitle')}</h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">{t('contact.mapSubtitle')}</p>
          <div className="mt-8 h-[300px] sm:h-[400px] md:h-[500px] rounded-2xl overflow-hidden shadow-2xl border border-white/10 animate-scale-in"><Map /></div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
