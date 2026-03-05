import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, CheckCircle2, ChevronRight, Download, FileText, User, Lock, ExternalLink } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface SubmittedCase {
  id: string;
  full_name: string;
  phone_number: string;
  status: string;
  created_at: string;
  education_level: string | null;
  city: string | null;
  passport_type: string | null;
  student_user_id: string | null;
  submission?: {
    id: string;
    service_fee: number;
    translation_fee: number;
    submitted_at: string | null;
    enrollment_paid_at: string | null;
    program_id: string | null;
    accommodation_id: string | null;
    program_start_date: string | null;
    program_end_date: string | null;
    payment_confirmed: boolean;
    extra_data: Record<string, unknown> | null;
  } | null;
  documents?: Array<{ id: string; file_name: string; file_url: string; category: string; created_at: string }>;
}

const AdminSubmissionsPage = () => {
  const { t, i18n } = useTranslation('dashboard');
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isRtl = i18n.language === 'ar';

  const [cases, setCases] = useState<SubmittedCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SubmittedCase | null>(null);
  const [marking, setMarking] = useState(false);

  // Password re-auth
  const [showPasswordGate, setShowPasswordGate] = useState(false);
  const [reAuthPassword, setReAuthPassword] = useState('');
  const [reAuthing, setReAuthing] = useState(false);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const casesRes = await supabase
        .from('cases')
        .select('id, full_name, phone_number, status, created_at, education_level, city, passport_type, student_user_id')
        .eq('status', 'submitted')
        .order('created_at', { ascending: false });

      if (casesRes.error) throw casesRes.error;
      const ids = (casesRes.data || []).map(c => c.id);

      if (ids.length === 0) { setCases([]); setLoading(false); return; }

      const [subRes, docsRes] = await Promise.all([
        supabase.from('case_submissions').select('*').in('case_id', ids),
        supabase.from('documents').select('id, file_name, file_url, category, created_at, case_id').in('case_id', ids),
      ]);

      const subMap: Record<string, any> = {};
      (subRes.data || []).forEach(s => { subMap[s.case_id] = s; });

      const docsMap: Record<string, any[]> = {};
      (docsRes.data || []).forEach(d => {
        if (!docsMap[d.case_id]) docsMap[d.case_id] = [];
        docsMap[d.case_id].push(d);
      });

      const enriched = (casesRes.data || []).map(c => ({
        ...c,
        submission: subMap[c.id] || null,
        documents: docsMap[c.id] || [],
      }));
      setCases(enriched);
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchCases(); }, [fetchCases]);

  const handleReAuth = async () => {
    if (!reAuthPassword.trim() || !user?.email) return;
    setReAuthing(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: user.email, password: reAuthPassword });
      if (error) throw error;
      setShowPasswordGate(false);
      setReAuthPassword('');
      // Now mark enrolled
      await markEnrolled();
    } catch (err: any) {
      toast({ variant: 'destructive', description: isRtl ? 'كلمة المرور غير صحيحة' : 'Incorrect password' });
    } finally {
      setReAuthing(false);
    }
  };

  const markEnrolled = async () => {
    if (!selected) return;
    setMarking(true);
    try {
      const { error: caseErr } = await supabase.from('cases').update({ status: 'enrollment_paid' }).eq('id', selected.id);
      if (caseErr) throw caseErr;

      if (selected.submission?.id) {
        const { error: subErr } = await supabase.from('case_submissions').update({
          enrollment_paid_at: new Date().toISOString(),
          enrollment_paid_by: user?.id,
        }).eq('id', selected.submission.id);
        if (subErr) throw subErr;
      }

      // Audit log
      await supabase.rpc('log_user_activity' as any, {
        p_action: 'MARK_ENROLLED',
        p_target_id: selected.id,
        p_target_table: 'cases',
        p_details: `Marked case ${selected.full_name} as enrolled`,
      });

      toast({ description: isRtl ? 'تم تسجيل القبول بنجاح' : 'Marked as enrolled' });
      setSelected(null);
      await fetchCases();
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setMarking(false);
    }
  };

  const fmt = (ts: string | null) => {
    if (!ts) return '–';
    return format(new Date(ts), 'dd/MM/yyyy');
  };

  const totalFee = (s: SubmittedCase) =>
    ((s.submission?.service_fee || 0) + (s.submission?.translation_fee || 0)).toLocaleString();

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('admin.submissions.title', 'Submitted Applications')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('admin.submissions.subtitle', 'Cases awaiting enrollment confirmation')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchCases}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">{isRtl ? 'جار التحميل...' : 'Loading...'}</div>
          ) : cases.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">{t('admin.submissions.empty', 'No submitted cases yet')}</div>
          ) : (
            <div className="divide-y divide-border">
              {cases.map(c => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => setSelected(c)}
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{c.full_name}</p>
                    <p className="text-xs text-muted-foreground">{c.phone_number} · {isRtl ? 'تم التقديم:' : 'Submitted:'} {fmt(c.submission?.submitted_at || null)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-end">
                      <p className="text-sm font-semibold text-foreground">{totalFee(c)} ILS</p>
                      <p className="text-xs text-muted-foreground">{isRtl ? 'إجمالي الرسوم' : 'Total fees'}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Full Case Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent dir={isRtl ? 'rtl' : 'ltr'} className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" /> {selected?.full_name}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-5">
              {/* Basic Info */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">{isRtl ? 'معلومات أساسية' : 'Basic Information'}</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">{isRtl ? 'الهاتف' : 'Phone'}:</span><p className="font-medium">{selected.phone_number}</p></div>
                  <div><span className="text-muted-foreground">{isRtl ? 'المدينة' : 'City'}:</span><p className="font-medium">{selected.city || '–'}</p></div>
                  <div><span className="text-muted-foreground">{isRtl ? 'المستوى التعليمي' : 'Education'}:</span><p className="font-medium">{selected.education_level || '–'}</p></div>
                  <div><span className="text-muted-foreground">{isRtl ? 'نوع الجواز' : 'Passport'}:</span><p className="font-medium">{selected.passport_type?.replace(/_/g, ' ') || '–'}</p></div>
                  <div><span className="text-muted-foreground">{isRtl ? 'تاريخ التقديم' : 'Submitted'}:</span><p className="font-medium">{fmt(selected.submission?.submitted_at || null)}</p></div>
                  <div><span className="text-muted-foreground">{isRtl ? 'الدفع' : 'Payment'}:</span>
                    <Badge className={selected.submission?.payment_confirmed ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}>
                      {selected.submission?.payment_confirmed ? '✅ Confirmed' : '⏳ Pending'}
                    </Badge>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Payment Details */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">{isRtl ? 'تفاصيل الدفع' : 'Payment Details'}</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">{isRtl ? 'رسوم الخدمة' : 'Service Fee'}:</span><p className="font-medium">{selected.submission?.service_fee?.toLocaleString() || 0} ILS</p></div>
                  <div><span className="text-muted-foreground">{isRtl ? 'رسوم الترجمة' : 'Translation Fee'}:</span><p className="font-medium">{selected.submission?.translation_fee?.toLocaleString() || 0} ILS</p></div>
                  {selected.submission?.program_start_date && (
                    <div><span className="text-muted-foreground">{isRtl ? 'تاريخ البدء' : 'Start Date'}:</span><p className="font-medium">{fmt(selected.submission.program_start_date)}</p></div>
                  )}
                  {selected.submission?.program_end_date && (
                    <div><span className="text-muted-foreground">{isRtl ? 'تاريخ الانتهاء' : 'End Date'}:</span><p className="font-medium">{fmt(selected.submission.program_end_date)}</p></div>
                  )}
                </div>
                <div className="mt-3 p-3 rounded-lg bg-muted text-sm">
                  <span className="text-muted-foreground">{isRtl ? 'الإجمالي' : 'Total'}:</span>
                  <span className="font-bold ms-2 text-foreground">{totalFee(selected)} ILS</span>
                </div>
              </div>

              {/* Extra Profile Data */}
              {selected.submission?.extra_data && Object.keys(selected.submission.extra_data).length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2">{isRtl ? 'بيانات الملف الشخصي' : 'Student Profile Data'}</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {Object.entries(selected.submission.extra_data).map(([key, val]) => {
                        if (!val || val === '') return null;
                        const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                        return (
                          <div key={key}>
                            <span className="text-muted-foreground">{label}:</span>
                            <p className="font-medium">{String(val)}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* Documents */}
              {selected.documents && selected.documents.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                      <FileText className="h-4 w-4" /> {isRtl ? 'المستندات' : 'Documents'} ({selected.documents.length})
                    </h3>
                    <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                      {selected.documents.map(doc => (
                        <div key={doc.id} className="flex items-center justify-between p-3 gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{doc.file_name}</p>
                            <p className="text-xs text-muted-foreground">{doc.category} · {fmt(doc.created_at)}</p>
                          </div>
                          <a href={doc.file_url} target="_blank" rel="noreferrer">
                            <Button size="sm" variant="outline" className="h-8 gap-1 shrink-0">
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <Separator />

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => { setSelected(null); navigate(`/team/cases/${selected.id}`); }}
                >
                  <ExternalLink className="h-4 w-4" />
                  {isRtl ? 'فتح الملف الكامل' : 'Open Full Case'}
                </Button>
                <Button
                  className="w-full gap-2"
                  onClick={() => setShowPasswordGate(true)}
                  disabled={marking}
                >
                  <Lock className="h-4 w-4" />
                  {marking ? (isRtl ? 'جار التسجيل...' : 'Processing...') : t('admin.submissions.markEnrolled', 'Mark as Enrolled')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Password Re-Auth Gate */}
      <Dialog open={showPasswordGate} onOpenChange={v => { setShowPasswordGate(v); setReAuthPassword(''); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              {isRtl ? 'تأكيد هويتك' : 'Confirm Your Identity'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {isRtl ? 'أدخل كلمة المرور الخاصة بك لتأكيد هذا الإجراء الحساس.' : 'Enter your password to confirm this sensitive action.'}
            </p>
            <div>
              <Label>{isRtl ? 'كلمة المرور' : 'Password'}</Label>
              <Input
                type="password"
                value={reAuthPassword}
                onChange={e => setReAuthPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleReAuth()}
                className="mt-1"
                placeholder="••••••••"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowPasswordGate(false); setReAuthPassword(''); }}>
              {isRtl ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={handleReAuth} disabled={reAuthing || !reAuthPassword.trim()}>
              {reAuthing ? '...' : (isRtl ? 'تأكيد وتسجيل' : 'Confirm & Enroll')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSubmissionsPage;
