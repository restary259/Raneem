import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Phone, GraduationCap, RefreshCw, Clock, CheckCircle2, UserPlus, Copy, Check, MessageCircle, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
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
  const [creating, setCreating] = useState(false);
  const [tempPwResult, setTempPwResult] = useState<{ password: string; name: string } | null>(null);
  const [copiedPw, setCopiedPw] = useState(false);

  const fetchStudents = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cases')
        .select('id, full_name, phone_number, status, last_activity_at, degree_interest, student_user_id')
        .eq('assigned_to', user.id)
        .in('status', ['submitted', 'enrollment_paid'])
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

  const openCreateModal = async () => {
    if (!user) return;
    // Fetch eligible cases (no student account yet, in advanced stages)
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
    setShowCreateModal(true);
  };

  const handleCreate = async () => {
    if (!selectedCaseId || !createEmail.trim()) return;
    const selectedCase = eligibleCases.find(c => c.id === selectedCaseId);
    if (!selectedCase) return;
    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-student-from-case`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session!.access_token}` },
        body: JSON.stringify({
          case_id: selectedCaseId,
          student_email: createEmail.trim(),
          student_full_name: selectedCase.full_name,
          student_phone: selectedCase.phone_number,
        }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || 'Failed to create account');

      setShowCreateModal(false);
      if (result.invited) {
        toast({ title: '✅ Invite Sent', description: `Invite email sent to ${createEmail}` });
      } else if (result.temp_password) {
        setTempPwResult({ password: result.temp_password, name: selectedCase.full_name });
      } else {
        toast({ title: 'Account created' });
      }
      fetchStudents();
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setCreating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'enrollment_paid') {
      return (
        <Badge className="bg-green-100 text-green-800 border-green-200 gap-1 text-xs">
          <CheckCircle2 className="h-3 w-3" />
          {isRtl ? 'مسجّل ✓' : 'Enrolled ✓'}
        </Badge>
      );
    }
    return (
      <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200 text-xs">
        {isRtl ? 'في انتظار معالجة الإدارة' : 'Awaiting Admin Processing'}
      </Badge>
    );
  };

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
        {isRtl
          ? 'الطلاب الذين تم تقديمهم أو تسجيلهم'
          : 'Students who have been submitted or enrolled'}
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
          <p>{isRtl ? 'لا يوجد طلاب مقدَّمون أو مسجَّلون بعد' : 'No submitted or enrolled students yet'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {cases.map(c => (
            <Card
              key={c.id}
              className="cursor-pointer hover:shadow-md transition-shadow border-border"
              onClick={() => navigate(`/team/cases/${c.id}`)}
            >
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{c.full_name}</div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {c.phone_number}
                      </span>
                      {c.degree_interest && (
                        <span className="flex items-center gap-1">
                          <GraduationCap className="h-3 w-3" />
                          {c.degree_interest}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(c.last_activity_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {c.student_user_id && (
                    <Badge variant="secondary" className="text-xs gap-1"><User className="h-3 w-3" />Account</Badge>
                  )}
                  {getStatusBadge(c.status)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Student Account Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              {isRtl ? 'إنشاء حساب طالب' : 'Create Student Account'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{isRtl ? 'اختر الملف' : 'Select Case'}</Label>
              {eligibleCases.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-2 p-3 rounded-lg bg-muted">
                  {isRtl
                    ? 'لا توجد ملفات مؤهلة لإنشاء حساب (يجب أن تكون في مرحلة استكمال الملف أو أعلى وبدون حساب طالب)'
                    : 'No eligible cases found. Cases must be in profile_completion stage or above and have no student account yet.'}
                </p>
              ) : (
                <Select value={selectedCaseId} onValueChange={setSelectedCaseId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={isRtl ? 'اختر الطالب' : 'Select a student'} />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleCases.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.full_name} — {c.status.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <Label>{isRtl ? 'البريد الإلكتروني' : 'Student Email'}</Label>
              <Input
                type="email"
                value={createEmail}
                onChange={e => setCreateEmail(e.target.value)}
                placeholder="student@example.com"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              {isRtl ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !selectedCaseId || !createEmail.trim() || eligibleCases.length === 0}
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : (isRtl ? 'إنشاء' : 'Create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Temp Password Result Modal */}
      <Dialog open={!!tempPwResult} onOpenChange={() => setTempPwResult(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>✅ {isRtl ? 'تم إنشاء الحساب' : 'Student Account Created'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {isRtl
                ? 'شارك هذه البيانات مع الطالب. لن تُعرض كلمة المرور مرة أخرى.'
                : 'Share these credentials with the student. The password will not be shown again.'}
            </p>
            <div className="p-3 rounded-lg bg-muted font-mono text-sm select-all break-all">{tempPwResult?.password}</div>
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
                size="sm" className="flex-1 gap-1 bg-green-600 hover:bg-green-700"
                onClick={() => {
                  const msg = encodeURIComponent(
                    `مرحبا ${tempPwResult?.name ?? ''},\nإليك بيانات تسجيل الدخول لبوابة DARB:\n🔗 darb.agency/login\n🔑 كلمة المرور المؤقتة: ${tempPwResult?.password}\n\nيرجى تغيير كلمة المرور عند أول دخول.`
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
