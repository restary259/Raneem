import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import StudentOverview from '@/components/students/StudentOverview';
import DocumentsPanel from '@/components/students/DocumentsPanel';

export default function TeamStudentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [caseData, setCaseData] = useState<Record<string, unknown> | null>(null);
  const [submission, setSubmission] = useState<Record<string, unknown> | null>(null);
  const [actorUserId, setActorUserId] = useState<string | null>(null);
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

  // Resolve the signed-in team member so document uploads are attributed to
  // them (uploaded_by) and the in-app notification names the actor.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setActorUserId(session?.user?.id ?? null);
    });
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;
  if (!profile) return <div className="p-6 text-muted-foreground">Not found</div>;

  const studentId = profile.id as string;
  const linkedCaseId = (caseData?.id as string) ?? null;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="shrink-0 gap-1" onClick={() => navigate('/team/students')}>
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        </Button>
      </div>

      <StudentOverview
        profile={profile}
        caseData={caseData}
        submission={submission}
        variant="page"
        caseHref={(cid) => `/team/cases/${cid}`}
        financeHref={(cid) => `/team/cases/${cid}`}
        renderDocumentsTab={() => (
          <DocumentsPanel
            studentId={studentId}
            caseId={linkedCaseId}
            actorUserId={actorUserId}
            canDelete={false}
          />
        )}
      />
    </div>
  );
}
