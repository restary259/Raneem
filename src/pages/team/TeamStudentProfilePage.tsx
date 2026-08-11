import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, User, Phone, Mail, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function TeamStudentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [caseData, setCaseData] = useState<Record<string, unknown> | null>(null);
  const [submission, setSubmission] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      // `:id` is the student account (profile) id, not a case id. The student
      // list links each row to /team/students/<profile id>.
      const { data: p } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
      if (!p) {
        setProfile(null);
        return;
      }
      setProfile(p);

      // Resolve the linked case, if any: the profile's direct case reference
      // first, then fall back to a case whose student_user_id is this account.
      const directCaseId = (p.case_id || p.linked_case_id) as string | null;
      const { data: c } = directCaseId
        ? await supabase.from('cases').select('*').eq('id', directCaseId).maybeSingle()
        : await supabase.from('cases').select('*').eq('student_user_id', id).maybeSingle();

      setCaseData(c ?? null);
      if (c) {
        const { data: subRes } = await supabase.from('case_submissions').select('*').eq('case_id', c.id).maybeSingle();
        setSubmission(subRes);
      } else {
        setSubmission(null);
      }
    } catch {
      toast({ variant: 'destructive', description: 'Something went wrong while loading the profile. Please try again.' });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  if (!profile) return <div className="p-6 text-muted-foreground">Not found</div>;

  const caseId = caseData?.id as string | undefined;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="sm" className="shrink-0" onClick={() => navigate('/team/students')}><ArrowLeft className="h-4 w-4" /></Button>
          <h1 className="text-xl sm:text-2xl font-bold truncate min-w-0 flex-1">{profile.full_name as string || '—'}</h1>
        </div>
        <div className="ps-1">
          {caseData ? (
            <Badge className={caseData.status === 'enrollment_paid' ? 'bg-green-100 text-green-800' : 'bg-teal-100 text-teal-800'}>
              {(caseData.status as string).replace(/_/g, ' ')}
            </Badge>
          ) : (
            <Badge variant="secondary">No linked case</Badge>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" /> Contact</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2"><Mail className="h-3 w-3 text-muted-foreground" />{profile.email as string || '—'}</div>
            <div className="flex items-center gap-2"><Phone className="h-3 w-3 text-muted-foreground" />{(caseData?.phone_number ?? profile.phone_number) as string || '—'}</div>
          </CardContent>
        </Card>

        {submission && (
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Submission</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {(submission.service_fee as number) > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">Service Fee</span><span className="font-medium">{(submission.service_fee as number).toLocaleString('en-US')} ILS</span></div>
              )}
              {submission.program_start_date && <div className="flex justify-between"><span className="text-muted-foreground">Start</span><span>{submission.program_start_date as string}</span></div>}
              {submission.program_end_date && <div className="flex justify-between"><span className="text-muted-foreground">End</span><span>{submission.program_end_date as string}</span></div>}
            </CardContent>
          </Card>
        )}
      </div>

      {caseId && <Button variant="outline" onClick={() => navigate(`/team/cases/${caseId}`)}>View Full Case</Button>}
    </div>
  );
}
