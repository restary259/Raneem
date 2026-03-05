import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RefreshCw, CheckCircle2, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface SubmittedCase {
  id: string;
  full_name: string;
  phone_number: string;
  status: string;
  created_at: string;
  submission?: {
    id: string;
    service_fee: number;
    translation_fee: number;
    submitted_at: string | null;
    enrollment_paid_at: string | null;
    program_id: string | null;
    accommodation_id: string | null;
  } | null;
}

const AdminSubmissionsPage = () => {
  const { t, i18n } = useTranslation('dashboard');
  const { toast } = useToast();
  const { user } = useAuth();
  const isRtl = i18n.language === 'ar';

  const [cases, setCases] = useState<SubmittedCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SubmittedCase | null>(null);
  const [marking, setMarking] = useState(false);

  const fetchCases = useCallback(async () => {
    try {
      const casesRes = await supabase
        .from('cases')
        .select('id, full_name, phone_number, status, created_at')
        .eq('status', 'submitted')
        .order('created_at', { ascending: false });

      if (casesRes.error) throw casesRes.error;
      const ids = (casesRes.data || []).map(c => c.id);

      let submissionMap: Record<string, any> = {};
      if (ids.length > 0) {
        const subRes = await supabase.from('case_submissions').select('*').in('case_id', ids);
        (subRes.data || []).forEach(s => { submissionMap[s.case_id] = s; });
      }

      const enriched = (casesRes.data || []).map(c => ({ ...c, submission: submissionMap[c.id] || null }));
      setCases(enriched);
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchCases(); }, [fetchCases]);

  const markEnrolled = async (caseId: string, submissionId: string | undefined) => {
    setMarking(true);
    try {
      const { error: caseErr } = await supabase.from('cases').update({ status: 'enrollment_paid' }).eq('id', caseId);
      if (caseErr) throw caseErr;

      if (submissionId) {
        const { error: subErr } = await supabase.from('case_submissions').update({
          enrollment_paid_at: new Date().toISOString(),
          enrollment_paid_by: user?.id,
        }).eq('id', submissionId);
        if (subErr) throw subErr;
      }

      toast({ description: isRtl ? 'تم تسجيل الدفع بنجاح' : 'Marked as enrolled & paid' });
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
    return new Date(ts).toLocaleDateString(isRtl ? 'ar-EG' : 'en-GB');
  };

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
                      <p className="text-sm font-semibold text-foreground">
                        {((c.submission?.service_fee || 0) + (c.submission?.translation_fee || 0)).toLocaleString()} ILS
                      </p>
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

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent dir={isRtl ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{selected?.full_name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">{isRtl ? 'الهاتف' : 'Phone'}:</span><p className="font-medium">{selected.phone_number}</p></div>
                <div><span className="text-muted-foreground">{isRtl ? 'تاريخ التقديم' : 'Submitted'}:</span><p className="font-medium">{fmt(selected.submission?.submitted_at || null)}</p></div>
                <div><span className="text-muted-foreground">{isRtl ? 'رسوم الخدمة' : 'Service Fee'}:</span><p className="font-medium">{selected.submission?.service_fee?.toLocaleString() || 0} ILS</p></div>
                <div><span className="text-muted-foreground">{isRtl ? 'رسوم الترجمة' : 'Translation Fee'}:</span><p className="font-medium">{selected.submission?.translation_fee?.toLocaleString() || 0} ILS</p></div>
              </div>
              <div className="p-3 rounded-lg bg-muted text-sm">
                <span className="text-muted-foreground">{isRtl ? 'الإجمالي' : 'Total'}:</span>
                <span className="font-bold ms-2 text-foreground">
                  {((selected.submission?.service_fee || 0) + (selected.submission?.translation_fee || 0)).toLocaleString()} ILS
                </span>
              </div>
              <Button
                className="w-full gap-2"
                onClick={() => markEnrolled(selected.id, selected.submission?.id)}
                disabled={marking}
              >
                <CheckCircle2 className="h-4 w-4" />
                {marking ? (isRtl ? 'جار التسجيل...' : 'Processing...') : t('admin.submissions.markEnrolled', 'Mark as Enrolled & Paid')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSubmissionsPage;
