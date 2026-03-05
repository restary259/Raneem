import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, differenceInYears, parseISO } from 'date-fns';
import { ArrowLeft, CalendarIcon, Loader2, Upload, X, Check, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

interface Program { id: string; name_en: string; name_ar: string; type: string; }
interface Accommodation { id: string; name_en: string; name_ar: string; price: number | null; currency: string; }

const GENDER_OPTIONS = ['male', 'female', 'other'] as const;
const ACCOMMODATION_TYPES = ['single', 'double', 'hall'] as const;
const ACCOMMODATION_CATEGORIES = ['A', 'B+', 'B', 'C', 'D', 'E'] as const;

type Step = 1 | 2 | 3;

export default function SubmitNewStudentPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { i18n } = useTranslation('dashboard');
  const isAr = i18n.language === 'ar';

  const [step, setStep] = useState<Step>(1);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [saving, setSaving] = useState(false);
  const [paymentReceived, setPaymentReceived] = useState(false);
  const [skipDocuments, setSkipDocuments] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; file: File; category: string }[]>([]);

  // Section A
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [cityOfBirth, setCityOfBirth] = useState('');
  const [street, setStreet] = useState('');
  const [houseNo, setHouseNo] = useState('');
  const [postcode, setPostcode] = useState('');
  const [city, setCity] = useState('');
  const [dob, setDob] = useState<Date | undefined>();
  const [gender, setGender] = useState('');

  // Section B
  const [programId, setProgramId] = useState('');
  const [school, setSchool] = useState('');
  const [arrivalDate, setArrivalDate] = useState<Date | undefined>();
  const [courseStart, setCourseStart] = useState<Date | undefined>();
  const [courseEnd, setCourseEnd] = useState<Date | undefined>();
  const [accommodationType, setAccommodationType] = useState('');
  const [accommodationCategory, setAccommodationCategory] = useState('');
  const [accommodationId, setAccommodationId] = useState('');
  const [serviceFee, setServiceFee] = useState('');
  const [translationFee, setTranslationFee] = useState('0');

  const age = dob ? differenceInYears(new Date(), dob) : null;
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');
  const total = (parseFloat(serviceFee) || 0) + (parseFloat(translationFee) || 0);

  useEffect(() => {
    Promise.all([
      supabase.from('programs').select('id, name_en, name_ar, type').eq('is_active', true),
      supabase.from('accommodations').select('id, name_en, name_ar, price, currency').eq('is_active', true),
    ]).then(([{ data: p }, { data: a }]) => {
      setPrograms(p ?? []);
      setAccommodations(a ?? []);
    });
  }, []);

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>, category: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFiles(prev => [...prev, { name: file.name, file, category }]);
    e.target.value = '';
  };

  const validateStep1 = () => {
    if (!firstName.trim() || !lastName.trim()) {
      toast({ variant: 'destructive', description: isAr ? 'الاسم الأول والأخير مطلوبان' : 'First and last name are required' });
      return false;
    }
    if (!email.trim() || !email.includes('@')) {
      toast({ variant: 'destructive', description: isAr ? 'البريد الإلكتروني غير صالح' : 'Valid email is required' });
      return false;
    }
    if (!phone.trim()) {
      toast({ variant: 'destructive', description: isAr ? 'رقم الهاتف مطلوب' : 'Phone is required' });
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!serviceFee || parseFloat(serviceFee) <= 0) {
      toast({ variant: 'destructive', description: isAr ? 'رسوم الخدمة مطلوبة' : 'Service fee is required' });
      return false;
    }
    if (!paymentReceived) {
      toast({ variant: 'destructive', description: isAr ? 'يجب تأكيد استلام الدفعة' : 'You must confirm payment was received' });
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateStep2()) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const { data: newCase, error: caseErr } = await supabase.from('cases').insert({
        full_name: fullName,
        phone_number: phone.trim(),
        source: 'submit_new_student',
        status: 'submitted',
        assigned_to: user!.id,
      }).select().single();
      if (caseErr) throw caseErr;

      const caseId = (newCase as any).id;

      await supabase.from('case_submissions').insert({
        case_id: caseId,
        program_id: programId || null,
        accommodation_id: accommodationId || null,
        program_start_date: courseStart ? format(courseStart, 'yyyy-MM-dd') : null,
        program_end_date: courseEnd ? format(courseEnd, 'yyyy-MM-dd') : null,
        service_fee: parseFloat(serviceFee),
        translation_fee: parseFloat(translationFee) || 0,
        payment_confirmed: true,
        payment_confirmed_at: now,
        payment_confirmed_by: user!.id,
        submitted_at: now,
        submitted_by: user!.id,
          extra_data: {
            first_name: firstName,
            middle_name: middleName,
            last_name: lastName,
            gender,
            city_of_birth: cityOfBirth,
            address: `${street} ${houseNo}, ${postcode} ${city}`.trim(),
            street, house_no: houseNo, postcode, city,
            date_of_birth: dob ? format(dob, 'yyyy-MM-dd') : null,
            age,
            emergency_contact_name: emergencyName,
            emergency_contact_phone: emergencyPhone,
            school,
            arrival_date: arrivalDate ? format(arrivalDate, 'yyyy-MM-dd') : null,
            accommodation_type: accommodationType,
            accommodation_category: accommodationCategory,
            documents_skipped: skipDocuments,
          },
      });

      // Upload documents if any
      if (uploadedFiles.length > 0) {
        for (const doc of uploadedFiles) {
          const path = `${caseId}/${doc.category}_${doc.file.name}`;
          const { data: uploadData } = await supabase.storage.from('student-documents').upload(path, doc.file, { upsert: true });
          if (uploadData?.path) {
            const { data: urlData } = supabase.storage.from('student-documents').getPublicUrl(uploadData.path);
            await supabase.from('documents').insert({
              student_id: user!.id,
              case_id: caseId,
              file_name: doc.file.name,
              file_url: urlData?.publicUrl || '',
              file_type: doc.file.type,
              file_size: doc.file.size,
              category: doc.category,
              uploaded_by: user!.id,
            });
          }
        }
      }

      // Create student account
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.functions.invoke('create-student-from-case', {
        body: { case_id: caseId, student_email: email.trim(), student_full_name: fullName, student_phone: phone.trim() },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });

      await supabase.rpc('log_activity' as any, {
        p_actor_id: user!.id,
        p_actor_name: 'Team Member',
        p_action: 'student_submitted_direct',
        p_entity_type: 'case',
        p_entity_id: caseId,
        p_metadata: { full_name: fullName, email },
      });

      toast({ title: isAr ? 'تم تسجيل الطالب بنجاح' : 'Student submitted & enrolled' });
      navigate(`/team/cases/${caseId}`);
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const StepIndicator = () => (
    <div className="flex items-center gap-2 mb-6">
      {([1, 2, 3] as Step[]).map((s, idx) => (
        <React.Fragment key={s}>
          <div className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
            step === s ? 'bg-primary text-primary-foreground' :
            step > s ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
          )}>
            {step > s ? <Check className="h-4 w-4" /> : s}
          </div>
          <span className={cn('text-xs font-medium hidden sm:block', step === s ? 'text-foreground' : 'text-muted-foreground')}>
            {s === 1 ? (isAr ? 'معلومات الطالب' : 'Student Info')
              : s === 2 ? (isAr ? 'البرنامج والدفع' : 'Program & Payment')
              : (isAr ? 'المستندات' : 'Documents')}
          </span>
          {idx < 2 && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
        </React.Fragment>
      ))}
    </div>
  );

  // Birthday picker — year/month/day dropdowns for DOB
  const BirthdayPicker = ({ label, value, onChange }: { label: string; value: Date | undefined; onChange: (d: Date | undefined) => void }) => {
    const years = Array.from({ length: 2015 - 1940 + 1 }, (_, i) => 1940 + i).reverse();
    const months = [
      { v: '01', l: isAr ? 'يناير' : 'January' }, { v: '02', l: isAr ? 'فبراير' : 'February' },
      { v: '03', l: isAr ? 'مارس' : 'March' }, { v: '04', l: isAr ? 'أبريل' : 'April' },
      { v: '05', l: isAr ? 'مايو' : 'May' }, { v: '06', l: isAr ? 'يونيو' : 'June' },
      { v: '07', l: isAr ? 'يوليو' : 'July' }, { v: '08', l: isAr ? 'أغسطس' : 'August' },
      { v: '09', l: isAr ? 'سبتمبر' : 'September' }, { v: '10', l: isAr ? 'أكتوبر' : 'October' },
      { v: '11', l: isAr ? 'نوفمبر' : 'November' }, { v: '12', l: isAr ? 'ديسمبر' : 'December' },
    ];
    const selYear = value ? value.getFullYear().toString() : '';
    const selMonth = value ? String(value.getMonth() + 1).padStart(2, '0') : '';
    const selDay = value ? String(value.getDate()).padStart(2, '0') : '';
    const daysInMonth = selYear && selMonth ? new Date(parseInt(selYear), parseInt(selMonth), 0).getDate() : 31;
    const days = Array.from({ length: daysInMonth }, (_, i) => String(i + 1).padStart(2, '0'));

    const update = (y: string, m: string, d: string) => {
      if (y && m && d) onChange(new Date(`${y}-${m}-${d}`));
    };
    return (
      <div>
        <Label>{label}</Label>
        <div className="grid grid-cols-3 gap-2 mt-1">
          <Select value={selYear} onValueChange={v => update(v, selMonth, selDay || '01')}>
            <SelectTrigger><SelectValue placeholder={isAr ? 'السنة' : 'Year'} /></SelectTrigger>
            <SelectContent className="max-h-48">{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={selMonth} onValueChange={v => update(selYear, v, selDay || '01')}>
            <SelectTrigger><SelectValue placeholder={isAr ? 'الشهر' : 'Month'} /></SelectTrigger>
            <SelectContent>{months.map(m => <SelectItem key={m.v} value={m.v}>{m.l}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={selDay} onValueChange={v => update(selYear, selMonth, v)}>
            <SelectTrigger><SelectValue placeholder={isAr ? 'اليوم' : 'Day'} /></SelectTrigger>
            <SelectContent>{days.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
    );
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
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={value} onSelect={onChange} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
    </div>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/team/cases')}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-2xl font-bold">{isAr ? 'تسجيل طالب جديد' : 'Submit New Student'}</h1>
      </div>

      <StepIndicator />

      {/* ─── Step 1: Student Information ─── */}
      {step === 1 && (
        <Card>
          <CardHeader><CardTitle className="text-base">{isAr ? 'أ — معلومات الطالب' : 'Section A — Student Information'}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div><Label>{isAr ? 'الاسم الأول *' : 'First Name *'}</Label><Input value={firstName} onChange={e => setFirstName(e.target.value)} /></div>
              <div><Label>{isAr ? 'الاسم الأوسط' : 'Middle Name'}</Label><Input value={middleName} onChange={e => setMiddleName(e.target.value)} /></div>
              <div><Label>{isAr ? 'الاسم الأخير *' : 'Last Name *'}</Label><Input value={lastName} onChange={e => setLastName(e.target.value)} /></div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div><Label>{isAr ? 'البريد الإلكتروني *' : 'Personal Email *'}</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="student@email.com" /></div>
              <div><Label>{isAr ? 'الهاتف *' : 'Phone *'}</Label><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+972..." /></div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div><Label>{isAr ? 'اسم جهة الاتصال للطوارئ' : 'Emergency Contact Name'}</Label><Input value={emergencyName} onChange={e => setEmergencyName(e.target.value)} /></div>
              <div><Label>{isAr ? 'هاتف الطوارئ' : 'Emergency Phone'}</Label><Input value={emergencyPhone} onChange={e => setEmergencyPhone(e.target.value)} /></div>
            </div>
            <div className="border-t border-border pt-4">
              <p className="text-sm font-medium text-muted-foreground mb-3">{isAr ? 'العنوان' : 'Address'}</p>
              <div className="grid md:grid-cols-2 gap-4">
                <div><Label>{isAr ? 'الشارع' : 'Street'}</Label><Input value={street} onChange={e => setStreet(e.target.value)} /></div>
                <div><Label>{isAr ? 'رقم المنزل' : 'House No.'}</Label><Input value={houseNo} onChange={e => setHouseNo(e.target.value)} /></div>
                <div><Label>{isAr ? 'الرمز البريدي' : 'Postcode'}</Label><Input value={postcode} onChange={e => setPostcode(e.target.value)} /></div>
                <div><Label>{isAr ? 'المدينة' : 'City'}</Label><Input value={city} onChange={e => setCity(e.target.value)} /></div>
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <div><Label>{isAr ? 'مدينة الميلاد' : 'City of Birth'}</Label><Input value={cityOfBirth} onChange={e => setCityOfBirth(e.target.value)} /></div>
              <div className="md:col-span-2">
                <BirthdayPicker label={isAr ? 'تاريخ الميلاد' : 'Date of Birth'} value={dob} onChange={setDob} />
                {age !== null && (
                  <p className="text-xs text-muted-foreground mt-1">{isAr ? `العمر: ${age} سنة` : `Age: ${age} years`}</p>
                )}
              </div>
            </div>
            <div>
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
            <div className="flex justify-end">
              <Button onClick={() => { if (validateStep1()) setStep(2); }}>
                {isAr ? 'التالي' : 'Next'} <ChevronRight className="h-4 w-4 ms-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Step 2: Program & Payment ─── */}
      {step === 2 && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">{isAr ? 'ب — البرنامج والإقامة' : 'Section B — Program & Accommodation'}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>{isAr ? 'البرنامج' : 'Program'}</Label>
                  <Select value={programId} onValueChange={setProgramId}>
                    <SelectTrigger><SelectValue placeholder={isAr ? 'اختر' : 'Select'} /></SelectTrigger>
                    <SelectContent>{programs.map(p => <SelectItem key={p.id} value={p.id}>{isAr ? p.name_ar : p.name_en}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>{isAr ? 'المدرسة' : 'School'}</Label><Input value={school} onChange={e => setSchool(e.target.value)} /></div>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <DateField label={isAr ? 'تاريخ الوصول' : 'Arrival Date'} value={arrivalDate} onChange={setArrivalDate} />
                <DateField label={isAr ? 'بداية الدورة' : 'Course Start'} value={courseStart} onChange={setCourseStart} />
                <DateField label={isAr ? 'نهاية الدورة' : 'Course End'} value={courseEnd} onChange={setCourseEnd} />
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <Label>{isAr ? 'نوع الإقامة' : 'Accommodation Type'}</Label>
                  <Select value={accommodationType} onValueChange={setAccommodationType}>
                    <SelectTrigger><SelectValue placeholder={isAr ? 'اختر' : 'Select'} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">{isAr ? 'فردي' : 'Single'}</SelectItem>
                      <SelectItem value="double">{isAr ? 'مزدوج' : 'Double'}</SelectItem>
                      <SelectItem value="hall">{isAr ? 'سكن طلابي' : 'Hall of Residence'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{isAr ? 'فئة الإقامة' : 'Accommodation Category'}</Label>
                  <Select value={accommodationCategory} onValueChange={setAccommodationCategory}>
                    <SelectTrigger><SelectValue placeholder={isAr ? 'اختر' : 'Select'} /></SelectTrigger>
                    <SelectContent>
                      {ACCOMMODATION_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{isAr ? 'الإقامة (من القائمة)' : 'Accommodation'}</Label>
                  <Select value={accommodationId} onValueChange={setAccommodationId}>
                    <SelectTrigger><SelectValue placeholder={isAr ? 'اختياري' : 'Optional'} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{isAr ? 'لا يوجد' : 'None'}</SelectItem>
                      {accommodations.map(a => <SelectItem key={a.id} value={a.id}>{isAr ? a.name_ar : a.name_en}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">{isAr ? 'الدفع' : 'Payment'}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div><Label>{isAr ? 'رسوم الخدمة (شيكل) *' : 'Service Fee (ILS) *'}</Label><Input type="number" min="0" value={serviceFee} onChange={e => setServiceFee(e.target.value)} /></div>
                <div><Label>{isAr ? 'رسوم الترجمة (شيكل)' : 'Translation Fee (ILS)'}</Label><Input type="number" min="0" value={translationFee} onChange={e => setTranslationFee(e.target.value)} /></div>
              </div>
              {total > 0 && (
                <div className="flex justify-between p-3 rounded-lg bg-muted text-sm font-medium">
                  <span>{isAr ? 'الإجمالي' : 'Total'}</span>
                  <span>{total.toLocaleString()} {isAr ? 'شيكل' : 'ILS'}</span>
                </div>
              )}
              <div className="flex items-start gap-3 p-3 border rounded-lg">
                <Checkbox id="pr" checked={paymentReceived} onCheckedChange={v => setPaymentReceived(v === true)} />
                <Label htmlFor="pr" className="cursor-pointer text-sm">
                  {isAr
                    ? `أؤكد استلام الدفعة الكاملة البالغة ${total.toLocaleString()} شيكل`
                    : `I confirm full payment of ${total.toLocaleString()} ILS has been received.`}
                </Label>
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>{isAr ? 'السابق' : 'Back'}</Button>
                <Button onClick={() => { if (validateStep2()) setStep(3); }}>
                  {isAr ? 'التالي' : 'Next'} <ChevronRight className="h-4 w-4 ms-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── Step 3: Documents ─── */}
      {step === 3 && (
        <Card>
          <CardHeader><CardTitle className="text-base">{isAr ? 'ج — المستندات' : 'Section C — Documents'}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {isAr
                ? 'يمكنك تحميل المستندات الآن أو تخطيها ليقوم الطالب بتحميلها لاحقاً.'
                : 'Upload documents now or skip — the student can upload later via their dashboard.'}
            </p>

            <div className="grid md:grid-cols-2 gap-4">
              {[
                { category: 'passport', label: isAr ? 'جواز السفر' : 'Passport' },
                { category: 'biometric_photo', label: isAr ? 'صورة بيومترية' : 'Biometric Photo' },
                { category: 'translation', label: isAr ? 'ترجمات' : 'Translations' },
                { category: 'other', label: isAr ? 'مستندات أخرى' : 'Other Documents' },
              ].map(doc => {
                const existing = uploadedFiles.filter(f => f.category === doc.category);
                return (
                  <div key={doc.category} className="border border-dashed border-border rounded-lg p-3">
                    <Label className="text-xs text-muted-foreground block mb-2">{doc.label}</Label>
                    {existing.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs mb-1">
                        <Check className="h-3 w-3 text-green-500 shrink-0" />
                        <span className="truncate">{f.name}</span>
                        <button onClick={() => setUploadedFiles(p => p.filter((_, idx) => !(p[idx].category === doc.category && idx === uploadedFiles.indexOf(f))))}
                          className="text-muted-foreground hover:text-destructive">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <label className="flex items-center gap-1 text-xs text-primary cursor-pointer hover:underline">
                      <Upload className="h-3 w-3" />
                      {isAr ? 'إضافة' : 'Add file'}
                      <input type="file" className="hidden" onChange={e => handleFileAdd(e, doc.category)} />
                    </label>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-2 p-3 border rounded-lg">
              <Checkbox id="skip" checked={skipDocuments} onCheckedChange={v => setSkipDocuments(v === true)} />
              <Label htmlFor="skip" className="text-sm cursor-pointer">
                {isAr ? 'تخطي — سيقوم الطالب بتحميل المستندات لاحقاً' : 'Skip — student will upload documents later'}
              </Label>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>{isAr ? 'السابق' : 'Back'}</Button>
              <Button onClick={handleSubmit} disabled={saving} size="lg">
                {saving
                  ? <><Loader2 className="h-4 w-4 me-2 animate-spin" />{isAr ? 'جار الإرسال...' : 'Submitting...'}</>
                  : (isAr ? 'إرسال وإنشاء حساب الطالب' : 'Submit & Create Student Account')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
