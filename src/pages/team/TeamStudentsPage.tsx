import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { User, Phone, GraduationCap, RefreshCw, Clock, CheckCircle2, UserPlus, Copy, Check, MessageCircle, Loader2, FileText, ExternalLink, Calendar, MapPin, Mail, Info } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface Case {
  id: string;
  full_name: string;
  phone_number: string;
  status: string;
  last_activity_at: string;
  degree_interest: string | null;
  student_user_id: string | null;
}

interface CaseSubmission {
  id: string;
  extra_data: Record<string, any> | null;
  program_start_date: string | null;
  program_end_date: string | null;
  service_fee: number;
  translation_fee: number;
  payment_confirmed: boolean;
  payment_confirmed_at: string | null;
  submitted_at: string | null;
}

interface Document {
  id: string;
  file_name: string;
  file_url: string;
  category: string;
  created_at: string;
  file_type: string | null;
}

const ELIGIBLE_STATUSES = ['profile_completion', 'payment_confirmed', 'submitted', 'enrollment_paid'];

export default function TeamStudentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { i18n } = useTranslation('dashboard');
  const isRtl = i18n.language === 'ar';

  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);

  // Create Student Account modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [eligibleCases, setEligibleCases] = useState<Case[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [emailFilter, setEmailFilter] = useState('');
  const [creating, setCreating] = useState(false);
  const [tempPwResult, setTempPwResult] = useState<{ password: string; name: string; email: string } | null>(null);
  const [copiedPw, setCopiedPw] = useState(false);

  // Student info sheet
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [submission, setSubmission] = useState<CaseSubmission | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [sheetLoading, setSheetLoading] = useState(false);

  const fetchStudents = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cases')
        .select('id, full_name, phone_number, status, last_activity_at, degree_interest, student_user_id')
        .eq('assigned_to', user.id)
        .in('status', ['submitted', 'enrollment_paid', 'profile_completion', 'payment_confirmed'])
        .order('last_activity_at', { ascending: false });

      if (error) throw error;
      setCases((data as Case[]) ?? []);
    } catch (err: any) {
      console.error('Error fetching students:', err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  const openStudentSheet = async (c: Case) => {
    setSelectedCase(c);
    setSheetLoading(true);
    try {
      const [subRes, docsRes] = await Promise.all([
        supabase.from('case_submissions').select('*').eq('case_id', c.id).maybeSingle(),
        supabase.from('documents').select('id, file_name, file_url, category, created_at, file_type').eq('case_id', c.id).order('created_at', { ascending: false }),
      ]);
      setSubmission(subRes.data as CaseSubmission | null);
      setDocuments((docsRes.data as Document[]) ?? []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setSheetLoading(false);
    }
  };

  const openCreateModal = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('cases')
      .select('id, full_name, phone_number, status, last_activity_at, degree_interest, student_user_id')
      .eq('assigned_to', user.id)
      .is('student_user_id', null)
      .in('status', ELIGIBLE_STATUSES)
      .order('full_name');
    setEligibleCases((data as Case[]) ?? []);
    setSelectedCaseId('');
    setCreateEmail('');
    setEmailFilter('');
    setShowCreateModal(true);
  };

  const filteredCases = emailFilter.trim().length > 0
    ? eligibleCases.filter(c =>
        c.full_name.toLowerCase().includes(emailFilter.toLowerCase()) ||
        c.phone_number.includes(emailFilter)
      )
    : eligibleCases;

  const handleCreate = async () => {
    if (!selectedCaseId || !createEmail.trim()) return;
    const theCase = eligibleCases.find(c => c.id === selectedCaseId);
    if (!theCase) return;
    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-student-from-case`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session!.access_token}` },
        body: JSON.stringify({
          case_id: selectedCaseId,
          student_email: createEmail.trim(),
          student_full_name: theCase.full_name,
          student_phone: theCase.phone_number,
          force_temp_password: true,
        }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || 'Failed to create account');

      setShowCreateModal(false);
      const pw = result.temp_password || result.password || '(check edge function)';
      setTempPwResult({ password: pw, name: theCase.full_name, email: createEmail.trim() });
      fetchStudents();
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setCreating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; labelAr: string; className: string }> = {
      profile_completion: { label: 'Profile Stage', labelAr: 'مرحلة الملف', className: 'bg-blue-100 text-blue-800 border-blue-200' },
      payment_confirmed: { label: 'Payment Confirmed', labelAr: 'تأكيد الدفع', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      submitted: { label: 'Submitted', labelAr: 'تم الإرسال', className: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
      enrollment_paid: { label: 'Enrolled ✓', labelAr: 'مسجّل ✓', className: 'bg-green-100 text-green-800 border-green-200' },
    };
    const s = map[status];
    if (!s) return <Badge className="text-xs">{status}</Badge>;
    return <Badge className={`${s.className} text-xs gap-1`}>{isRtl ? s.labelAr : s.label}</Badge>;
  };

  const ex = submission?.extra_data ?? {};

  return (
    <div className="p-6 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">
            {isRtl ? 'طلابي' : 'My Students'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="default" size="sm" onClick={openCreateModal} className="gap-1.5">
            <UserPlus className="h-3.5 w-3.5" />
            {isRtl ? 'إنشاء حساب طالب' : 'Create Student Account'}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchStudents} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            {isRtl ? 'تحديث' : 'Refresh'}
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {isRtl ? 'الطلاب في مرحلة استكمال الملف أو ما بعدها' : 'Students in profile completion stage or beyond'}
      </p>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : cases.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <GraduationCap className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>{isRtl ? 'لا يوجد طلاب بعد' : 'No students yet'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {cases.map(c => (
            <Card
              key={c.id}
              className="cursor-pointer hover:shadow-md transition-shadow border-border"
              onClick={() => openStudentSheet(c)}
            >
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{c.full_name}</div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone_number}</span>
                      {c.degree_interest && <span className="flex items-center gap-1"><GraduationCap className="h-3 w-3" />{c.degree_interest}</span>}
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDistanceToNow(new Date(c.last_activity_at), { addSuffix: true })}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {c.student_user_id && <Badge variant="secondary" className="text-xs gap-1"><User className="h-3 w-3" />Account</Badge>}
                  {getStatusBadge(c.status)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Student Info Sheet ── */}
      <Sheet open={!!selectedCase} onOpenChange={open => { if (!open) setSelectedCase(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              {selectedCase?.full_name}
            </SheetTitle>
          </SheetHeader>

          {sheetLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="mt-4 space-y-5">
              {/* Status + basic */}
              <div className="flex items-center gap-2 flex-wrap">
                {selectedCase && getStatusBadge(selectedCase.status)}
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" />{selectedCase?.phone_number}
                </span>
              </div>

              {/* Personal Info */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{isRtl ? 'المعلومات الشخصية' : 'Personal Info'}</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {ex.gender && <InfoRow icon={<User className="h-3 w-3" />} label={isRtl ? 'الجنس' : 'Gender'} value={ex.gender} />}
                  {ex.date_of_birth && <InfoRow icon={<Calendar className="h-3 w-3" />} label={isRtl ? 'تاريخ الميلاد' : 'DOB'} value={ex.date_of_birth} />}
                  {ex.age && <InfoRow icon={<Info className="h-3 w-3" />} label={isRtl ? 'العمر' : 'Age'} value={`${ex.age} ${isRtl ? 'سنة' : 'yrs'}`} />}
                  {ex.city_of_birth && <InfoRow icon={<MapPin className="h-3 w-3" />} label={isRtl ? 'مدينة الميلاد' : 'City of Birth'} value={ex.city_of_birth} />}
                  {(ex.student_email) && <InfoRow icon={<Mail className="h-3 w-3" />} label={isRtl ? 'البريد' : 'Email'} value={ex.student_email} />}
                  {(ex.student_phone) && <InfoRow icon={<Phone className="h-3 w-3" />} label={isRtl ? 'الهاتف' : 'Phone'} value={ex.student_phone} />}
                  {ex.address && <InfoRow icon={<MapPin className="h-3 w-3" />} label={isRtl ? 'العنوان' : 'Address'} value={ex.address} className="col-span-2" />}
                  {ex.emergency_contact_name && <InfoRow icon={<User className="h-3 w-3" />} label={isRtl ? 'طوارئ' : 'Emergency'} value={`${ex.emergency_contact_name} ${ex.emergency_contact_phone || ''}`} className="col-span-2" />}
                </div>
              </div>

              <Separator />

              {/* Program & Payment */}
              {submission && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{isRtl ? 'البرنامج والدفع' : 'Program & Payment'}</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    {ex.school && <InfoRow icon={<GraduationCap className="h-3 w-3" />} label={isRtl ? 'المدرسة' : 'School'} value={ex.school} />}
                    {submission.program_start_date && <InfoRow icon={<Calendar className="h-3 w-3" />} label={isRtl ? 'بداية الدورة' : 'Start'} value={format(new Date(submission.program_start_date), 'PP')} />}
                    {submission.program_end_date && <InfoRow icon={<Calendar className="h-3 w-3" />} label={isRtl ? 'نهاية الدورة' : 'End'} value={format(new Date(submission.program_end_date), 'PP')} />}
                    {ex.arrival_date && <InfoRow icon={<Calendar className="h-3 w-3" />} label={isRtl ? 'الوصول' : 'Arrival'} value={ex.arrival_date} />}
                    {ex.accommodation_type && <InfoRow icon={<MapPin className="h-3 w-3" />} label={isRtl ? 'الإقامة' : 'Accommodation'} value={ex.accommodation_type} />}
                    <InfoRow icon={<Info className="h-3 w-3" />} label={isRtl ? 'رسوم الخدمة' : 'Service Fee'} value={`${submission.service_fee?.toLocaleString()} ILS`} />
                    {(submission.translation_fee > 0) && <InfoRow icon={<Info className="h-3 w-3" />} label={isRtl ? 'رسوم الترجمة' : 'Translation Fee'} value={`${submission.translation_fee?.toLocaleString()} ILS`} />}
                    <InfoRow icon={submission.payment_confirmed ? <CheckCircle2 className="h-3 w-3 text-green-600" /> : <Info className="h-3 w-3" />} label={isRtl ? 'الدفع' : 'Payment'} value={submission.payment_confirmed ? (isRtl ? 'مؤكد' : 'Confirmed') : (isRtl ? 'معلق' : 'Pending')} />
                    {submission.submitted_at && <InfoRow icon={<CheckCircle2 className="h-3 w-3" />} label={isRtl ? 'تاريخ الإرسال' : 'Submitted'} value={format(new Date(submission.submitted_at), 'PP')} />}
                  </div>
                </div>
              )}

              {/* Documents */}
              <Separator />
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{isRtl ? 'المستندات' : 'Documents'} ({documents.length})</p>
                {documents.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{isRtl ? 'لا توجد مستندات' : 'No documents uploaded'}</p>
                ) : (
                  <div className="space-y-2">
                    {documents.map(doc => (
                      <div key={doc.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate font-medium">{doc.file_name}</span>
                          <Badge variant="outline" className="text-xs capitalize shrink-0">{doc.category.replace(/_/g, ' ')}</Badge>
                        </div>
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline shrink-0">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />
              <Button variant="outline" className="w-full gap-2" onClick={() => { setSelectedCase(null); navigate(`/team/cases/${selectedCase?.id}`); }}>
                <ExternalLink className="h-4 w-4" />
                {isRtl ? 'فتح الملف الكامل' : 'Open Full Case'}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Create Student Account Modal ── */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              {isRtl ? 'إنشاء حساب طالب' : 'Create Student Account'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{isRtl ? 'البريد الإلكتروني للطالب *' : 'Student Email *'}</Label>
              <Input
                type="email"
                value={createEmail}
                onChange={e => setCreateEmail(e.target.value)}
                placeholder="student@example.com"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {isRtl ? 'سيتم إنشاء الحساب مع كلمة مرور مؤقتة' : 'Account will be created with a temporary password'}
              </p>
            </div>

            <div>
              <Label>{isRtl ? 'البحث والاختيار من الملفات' : 'Search & Select Case'}</Label>
              <Input
                value={emailFilter}
                onChange={e => setEmailFilter(e.target.value)}
                placeholder={isRtl ? 'ابحث بالاسم أو الهاتف...' : 'Search by name or phone...'}
                className="mt-1 mb-2"
              />
              {filteredCases.length === 0 ? (
                <p className="text-xs text-muted-foreground p-3 rounded-lg bg-muted">
                  {eligibleCases.length === 0
                    ? (isRtl ? 'لا توجد ملفات مؤهلة' : 'No eligible cases found')
                    : (isRtl ? 'لا توجد نتائج' : 'No results match your search')}
                </p>
              ) : (
                <Select value={selectedCaseId} onValueChange={setSelectedCaseId}>
                  <SelectTrigger>
                    <SelectValue placeholder={isRtl ? 'اختر الطالب' : 'Select a student'} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredCases.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.full_name} — {c.phone_number} ({c.status.replace(/_/g, ' ')})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              {isRtl ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !selectedCaseId || !createEmail.trim()}
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : (isRtl ? 'إنشاء' : 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Temp Password Result ── */}
      <Dialog open={!!tempPwResult} onOpenChange={() => setTempPwResult(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>✅ {isRtl ? 'تم إنشاء الحساب' : 'Account Created'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-1">
              <p><span className="font-medium">{isRtl ? 'الطالب:' : 'Student:'}</span> {tempPwResult?.name}</p>
              <p><span className="font-medium">{isRtl ? 'البريد:' : 'Email:'}</span> {tempPwResult?.email}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">{isRtl ? 'كلمة المرور المؤقتة (أعطها للطالب الآن)' : 'Temporary Password — give to student now'}</Label>
              <div className="p-3 rounded-lg bg-muted font-mono text-sm select-all break-all mt-1 border border-border">{tempPwResult?.password}</div>
            </div>
            <p className="text-xs text-warning-foreground bg-warning/10 p-2 rounded border border-warning/20">{isRtl ? 'لن تُعرض كلمة المرور مرة أخرى. انسخها الآن.' : 'Password will not be shown again. Copy it now.'}</p>
            <div className="flex gap-2">
              <Button
                variant="outline" size="sm" className="flex-1 gap-1"
                onClick={() => {
                  navigator.clipboard.writeText(tempPwResult?.password ?? '');
                  setCopiedPw(true);
                  setTimeout(() => setCopiedPw(false), 2000);
                }}
              >
                {copiedPw ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copiedPw ? (isRtl ? 'تم النسخ' : 'Copied!') : (isRtl ? 'نسخ' : 'Copy')}
              </Button>
              <Button
                size="sm" className="flex-1 gap-1 bg-[hsl(142,76%,36%)] hover:bg-[hsl(142,76%,30%)] text-white"
                onClick={() => {
                  const msg = encodeURIComponent(
                    `مرحبا ${tempPwResult?.name ?? ''},\nإليك بيانات تسجيل الدخول لبوابة DARB:\n🔗 darb.agency/login\n📧 ${tempPwResult?.email}\n🔑 كلمة المرور المؤقتة: ${tempPwResult?.password}\n\nيرجى تغيير كلمة المرور عند أول دخول.`
                  );
                  window.open(`https://wa.me/?text=${msg}`, '_blank');
                }}
              >
                <MessageCircle className="h-4 w-4" />
                {isRtl ? 'واتساب' : 'WhatsApp'}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setTempPwResult(null)}>{isRtl ? 'تم' : 'Done'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Small helper component
function InfoRow({ icon, label, value, className }: { icon: React.ReactNode; label: string; value: string; className?: string }) {
  return (
    <div className={`flex flex-col gap-0.5 ${className ?? ''}`}>
      <span className="text-xs text-muted-foreground flex items-center gap-1">{icon}{label}</span>
      <span className="text-sm font-medium text-foreground truncate">{value}</span>
    </div>
  );
}
