import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, differenceInYears } from 'date-fns';
import { CalendarIcon, Loader2, ChevronRight, ChevronLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Program { id: string; name_en: string; name_ar: string; type: string; }
interface Accommodation { id: string; name_en: string; name_ar: string; price: number | null; currency: string; }

const PREFERRED_SUBJECTS = ['math', 'english', 'science', 'german', 'arabic', 'computer_science', 'art', 'other'];
const ACCOMMODATION_TYPES = ['single', 'double', 'hall'];
const ACCOMMODATION_CATEGORIES = ['A', 'B+', 'B', 'C', 'D', 'E'];

interface Props {
  caseId: string;
  actorId: string;
  actorName: string;
  existingData?: Record<string, unknown>;
  onSuccess: () => void;
}

type FormStep = 'a' | 'b';

export default function ProfileCompletionForm({ caseId, actorId, actorName, existingData, onSuccess }: Props) {
  const { toast } = useToast();
  const { i18n } = useTranslation('dashboard');
  const isAr = i18n.language === 'ar';
  const [programs, setPrograms] = useState<Program[]>([]);
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [saving, setSaving] = useState(false);
  const [formStep, setFormStep] = useState<FormStep>('a');

  // Section A — Student Identity
  const ex = existingData ?? {};
  const [firstName, setFirstName] = useState((ex.first_name as string) ?? '');
  const [middleName, setMiddleName] = useState((ex.middle_name as string) ?? '');
  const [lastName, setLastName] = useState((ex.last_name as string) ?? '');
  const [email, setEmail] = useState((ex.student_email as string) ?? '');
  const [phone, setPhone] = useState((ex.student_phone as string) ?? '');
  const [emergencyName, setEmergencyName] = useState((ex.emergency_contact_name as string) ?? '');
  const [emergencyPhone, setEmergencyPhone] = useState((ex.emergency_contact_phone as string) ?? '');
  const [cityOfBirth, setCityOfBirth] = useState((ex.city_of_birth as string) ?? '');
  const [street, setStreet] = useState((ex.street as string) ?? '');
  const [houseNo, setHouseNo] = useState((ex.house_no as string) ?? '');
  const [postcode, setPostcode] = useState((ex.postcode as string) ?? '');
  const [city, setCity] = useState((ex.city as string) ?? '');
  const [dob, setDob] = useState<Date | undefined>(ex.date_of_birth ? new Date(ex.date_of_birth as string) : undefined);
  const [gender, setGender] = useState((ex.gender as string) ?? '');

  // Section B — Program & Accommodation
  const [programId, setProgramId] = useState((ex.program_id as string) ?? '');
  const [school, setSchool] = useState((ex.school as string) ?? '');
  const [arrivalDate, setArrivalDate] = useState<Date | undefined>(ex.arrival_date ? new Date(ex.arrival_date as string) : undefined);
  const [courseStart, setCourseStart] = useState<Date | undefined>(ex.course_start ? new Date(ex.course_start as string) : undefined);
  const [courseEnd, setCourseEnd] = useState<Date | undefined>(ex.course_end ? new Date(ex.course_end as string) : undefined);
  const [accommodationType, setAccommodationType] = useState((ex.accommodation_type as string) ?? '');
  const [accommodationCategory, setAccommodationCategory] = useState((ex.accommodation_category as string) ?? '');
  const [accommodationId, setAccommodationId] = useState((ex.accommodation_id as string) ?? '');
  const [preferredSubjects, setPreferredSubjects] = useState<string[]>((ex.preferred_subjects as string[]) ?? []);
  const [serviceFee, setServiceFee] = useState((ex.service_fee as string) ?? '');

  const age = dob ? differenceInYears(new Date(), dob) : null;
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');

  useEffect(() => {
    Promise.all([
      supabase.from('programs').select('id, name_en, name_ar, type').eq('is_active', true).order('name_en'),
      supabase.from('accommodations').select('id, name_en, name_ar, price, currency').eq('is_active', true),
    ]).then(([{ data: progs }, { data: accs }]) => {
      setPrograms(progs ?? []);
      setAccommodations(accs ?? []);
    });
  }, []);

  const toggleSubject = (s: string) =>
    setPreferredSubjects(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const validateSectionA = () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast({ variant: 'destructive', description: isAr ? 'الاسم الأول والأخير مطلوبان' : 'First and last name are required' });
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast({ variant: 'destructive', description: isAr ? 'الاسم الأول والأخير مطلوبان' : 'First and last name are required' });
      return;
    }
    setSaving(true);
    try {
      const extraData = {
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        student_email: email,
        student_phone: phone,
        emergency_contact_name: emergencyName,
        emergency_contact_phone: emergencyPhone,
        city_of_birth: cityOfBirth,
        street, house_no: houseNo, postcode, city,
        date_of_birth: dob ? format(dob, 'yyyy-MM-dd') : null,
        age,
        gender,
        program_id: programId || null,
        accommodation_id: accommodationId || null,
        school,
        arrival_date: arrivalDate ? format(arrivalDate, 'yyyy-MM-dd') : null,
        course_start: courseStart ? format(courseStart, 'yyyy-MM-dd') : null,
        course_end: courseEnd ? format(courseEnd, 'yyyy-MM-dd') : null,
        accommodation_type: accommodationType,
        accommodation_category: accommodationCategory,
        preferred_subjects: preferredSubjects,
        service_fee: serviceFee,
      };

      // Upsert case_submissions with all data
      const { error } = await supabase.from('case_submissions').upsert({
        case_id: caseId,
        program_id: programId || null,
        accommodation_id: accommodationId || null,
        program_start_date: courseStart ? format(courseStart, 'yyyy-MM-dd') : null,
        program_end_date: courseEnd ? format(courseEnd, 'yyyy-MM-dd') : null,
        service_fee: parseFloat(serviceFee) || 0,
        extra_data: extraData,
      }, { onConflict: 'case_id' });
      if (error) throw error;

      // Update case full_name and phone
      await supabase.from('cases').update({
        full_name: fullName || undefined,
        phone_number: phone || undefined,
        status: 'profile_completion',
      }).eq('id', caseId);

      await supabase.rpc('log_activity' as any, {
        p_actor_id: actorId,
        p_actor_name: actorName,
        p_action: 'profile_filled',
        p_entity_type: 'case',
        p_entity_id: caseId,
        p_metadata: { full_name: fullName },
      });

      toast({ title: isAr ? 'تم حفظ الملف الشخصي' : 'Profile saved' });
      onSuccess();
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const DateField = ({ label, value, onChange }: { label: string; value: Date | undefined; onChange: (d: Date | undefined) => void }) => (
    <div>
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn('w-full justify-start text-left font-normal mt-1', !value && 'text-muted-foreground')}>
            <CalendarIcon className="me-2 h-4 w-4" />
            {value ? format(value, 'PP') : (isAr ? 'اختر التاريخ' : 'Pick date')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 z-50" align="start">
          <Calendar mode="single" selected={value} onSelect={onChange} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => setFormStep('a')}
          className={cn('flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-colors',
            formStep === 'a' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
          )}
        >
          A — {isAr ? 'معلومات الطالب' : 'Student Info'}
        </button>
        <ChevronRight className="h-3 w-3 text-muted-foreground" />
        <button
          onClick={() => { if (validateSectionA()) setFormStep('b'); }}
          className={cn('flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-colors',
            formStep === 'b' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
          )}
        >
          B — {isAr ? 'البرنامج والإقامة' : 'Program & Accommodation'}
        </button>
      </div>

      {/* ── Section A ── */}
      {formStep === 'a' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>{isAr ? 'الاسم الأول *' : 'First Name *'}</Label>
              <Input value={firstName} onChange={e => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{isAr ? 'الاسم الأوسط' : 'Middle Name'}</Label>
              <Input value={middleName} onChange={e => setMiddleName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{isAr ? 'الاسم الأخير *' : 'Last Name *'}</Label>
              <Input value={lastName} onChange={e => setLastName(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{isAr ? 'البريد الإلكتروني' : 'Email'}</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="student@email.com" />
            </div>
            <div className="space-y-1">
              <Label>{isAr ? 'الهاتف' : 'Phone'}</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+972..." />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{isAr ? 'جهة اتصال الطوارئ' : 'Emergency Contact'}</Label>
              <Input value={emergencyName} onChange={e => setEmergencyName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{isAr ? 'هاتف الطوارئ' : 'Emergency Phone'}</Label>
              <Input value={emergencyPhone} onChange={e => setEmergencyPhone(e.target.value)} />
            </div>
          </div>

          <div className="border-t border-border pt-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">{isAr ? 'العنوان' : 'Address'}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="col-span-2 space-y-1"><Label>{isAr ? 'الشارع' : 'Street'}</Label><Input value={street} onChange={e => setStreet(e.target.value)} /></div>
              <div className="space-y-1"><Label>{isAr ? 'رقم المنزل' : 'House No.'}</Label><Input value={houseNo} onChange={e => setHouseNo(e.target.value)} /></div>
              <div className="space-y-1"><Label>{isAr ? 'الرمز البريدي' : 'Postcode'}</Label><Input value={postcode} onChange={e => setPostcode(e.target.value)} /></div>
              <div className="col-span-2 space-y-1"><Label>{isAr ? 'المدينة' : 'City'}</Label><Input value={city} onChange={e => setCity(e.target.value)} /></div>
              <div className="col-span-2 space-y-1"><Label>{isAr ? 'مدينة الميلاد' : 'City of Birth'}</Label><Input value={cityOfBirth} onChange={e => setCityOfBirth(e.target.value)} /></div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <DateField label={isAr ? 'تاريخ الميلاد' : 'Date of Birth'} value={dob} onChange={setDob} />
              {age !== null && <p className="text-xs text-muted-foreground mt-1">{isAr ? `العمر: ${age} سنة` : `Age: ${age}`}</p>}
            </div>
            <div className="space-y-1">
              <Label>{isAr ? 'الجنس' : 'Gender'}</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger><SelectValue placeholder={isAr ? 'اختر' : 'Select'} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">{isAr ? 'ذكر' : 'Male'}</SelectItem>
                  <SelectItem value="female">{isAr ? 'أنثى' : 'Female'}</SelectItem>
                  <SelectItem value="other">{isAr ? 'آخر' : 'Other'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={() => { if (validateSectionA()) setFormStep('b'); }}>
              {isAr ? 'التالي' : 'Next'} <ChevronRight className="h-4 w-4 ms-1" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Section B ── */}
      {formStep === 'b' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{isAr ? 'البرنامج' : 'Program'}</Label>
              <Select value={programId} onValueChange={setProgramId}>
                <SelectTrigger><SelectValue placeholder={isAr ? 'اختر البرنامج' : 'Select program'} /></SelectTrigger>
                <SelectContent>
                  {programs.map(p => (
                    <SelectItem key={p.id} value={p.id}>{isAr ? p.name_ar : p.name_en}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{isAr ? 'المدرسة' : 'School'}</Label>
              <Select value={school} onValueChange={setSchool}>
                <SelectTrigger><SelectValue placeholder={isAr ? 'اختر المدرسة' : 'Select school'} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="F+U Academy of Languages">F+U Academy of Languages</SelectItem>
                  <SelectItem value="Alpha Aktiv">Alpha Aktiv</SelectItem>
                  <SelectItem value="GO Academy">GO Academy</SelectItem>
                  <SelectItem value="VICTORIA Academy">VICTORIA Academy</SelectItem>
                  <SelectItem value="other">{isAr ? 'أخرى' : 'Other'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <DateField label={isAr ? 'تاريخ الوصول' : 'Arrival Date'} value={arrivalDate} onChange={setArrivalDate} />
            <DateField label={isAr ? 'بداية الدورة' : 'Course Start'} value={courseStart} onChange={setCourseStart} />
            <DateField label={isAr ? 'نهاية الدورة' : 'Course End'} value={courseEnd} onChange={setCourseEnd} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{isAr ? 'الإقامة' : 'Accommodation'}</Label>
              <Select value={accommodationId} onValueChange={setAccommodationId}>
                <SelectTrigger><SelectValue placeholder={isAr ? 'اختر الإقامة' : 'Select accommodation'} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{isAr ? 'بدون إقامة' : 'None'}</SelectItem>
                  {accommodations.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {isAr ? a.name_ar : a.name_en} {a.price ? `(${a.price} ${a.currency})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{isAr ? 'نوع الإقامة' : 'Accommodation Type'}</Label>
              <Select value={accommodationType} onValueChange={setAccommodationType}>
                <SelectTrigger><SelectValue placeholder={isAr ? 'اختر' : 'Select'} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">{isAr ? 'فردي' : 'Single'}</SelectItem>
                  <SelectItem value="double">{isAr ? 'مزدوج' : 'Double'}</SelectItem>
                  <SelectItem value="hall">{isAr ? 'سكن جماعي' : 'Hall'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{isAr ? 'فئة الإقامة' : 'Accommodation Category'}</Label>
              <Select value={accommodationCategory} onValueChange={setAccommodationCategory}>
                <SelectTrigger><SelectValue placeholder={isAr ? 'اختر' : 'Select'} /></SelectTrigger>
                <SelectContent>
                  {ACCOMMODATION_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{isAr ? 'رسوم الخدمة (ILS)' : 'Service Fee (ILS)'}</Label>
              <Input type="number" value={serviceFee} onChange={e => setServiceFee(e.target.value)} placeholder="0" />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">{isAr ? 'المواد المفضلة' : 'Preferred Subjects'}</Label>
            <div className="flex flex-wrap gap-2">
              {PREFERRED_SUBJECTS.map(s => (
                <label key={s} className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox
                    checked={preferredSubjects.includes(s)}
                    onCheckedChange={() => toggleSubject(s)}
                  />
                  <span className="text-xs capitalize">{s.replace(/_/g, ' ')}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" onClick={() => setFormStep('a')}>
              <ChevronLeft className="h-4 w-4 me-1" />{isAr ? 'السابق' : 'Back'}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 me-2 animate-spin" />{isAr ? 'جاري الحفظ...' : 'Saving...'}</> : (isAr ? 'حفظ الملف الشخصي' : 'Save Profile')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
