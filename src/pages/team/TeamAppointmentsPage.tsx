import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { isToday, isFuture, isPast, format, formatDistanceToNow } from 'date-fns';
import AppointmentOutcomeModal from '@/components/team/AppointmentOutcomeModal';

interface Appointment {
  id: string; case_id: string; scheduled_at: string; duration_minutes: number;
  outcome: string | null; notes: string | null;
  case?: { full_name: string; status: string };
}

export default function TeamAppointmentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [outcomeApptId, setOutcomeApptId] = useState<string | null>(null);

  const fetchAppts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('appointments')
      .select('*, case:cases(full_name, status)')
      .eq('team_member_id', user.id)
      .order('scheduled_at', { ascending: false });
    setAppts((data as any[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchAppts(); }, [fetchAppts]);

  const todayAppts = appts.filter(a => isToday(new Date(a.scheduled_at)));
  const upcomingAppts = appts.filter(a => isFuture(new Date(a.scheduled_at)) && !isToday(new Date(a.scheduled_at)));
  const pastNeedOutcome = appts.filter(a => isPast(new Date(a.scheduled_at)) && !a.outcome && !isToday(new Date(a.scheduled_at)));
  const pastWithOutcome = appts.filter(a => isPast(new Date(a.scheduled_at)) && a.outcome);

  const renderAppt = (a: Appointment) => (
    <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
      <div>
        <div className="font-medium">{(a.case as any)?.full_name ?? 'Unknown'}</div>
        <div className="text-sm text-muted-foreground">{format(new Date(a.scheduled_at), 'MMM d, h:mm a')} · {a.duration_minutes}min</div>
        {a.notes && <div className="text-xs text-muted-foreground mt-0.5">{a.notes}</div>}
      </div>
      <div className="flex items-center gap-2">
        {a.outcome ? <Badge variant="secondary">{a.outcome}</Badge> : null}
        {!a.outcome && isPast(new Date(a.scheduled_at)) && (
          <Button size="sm" variant="destructive" onClick={() => setOutcomeApptId(a.id)}>Record Outcome</Button>
        )}
        <Button size="sm" variant="outline" onClick={() => navigate(`/team/cases/${a.case_id}`)}>Case</Button>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold">Appointments</h1>

      {pastNeedOutcome.length > 0 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader className="pb-2"><CardTitle className="text-base text-destructive">⚠ Need Outcome ({pastNeedOutcome.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">{pastNeedOutcome.map(renderAppt)}</CardContent>
        </Card>
      )}

      {todayAppts.length > 0 && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2"><CardTitle className="text-base">Today ({todayAppts.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">{todayAppts.map(renderAppt)}</CardContent>
        </Card>
      )}

      {upcomingAppts.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Upcoming ({upcomingAppts.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">{upcomingAppts.map(renderAppt)}</CardContent>
        </Card>
      )}

      {pastWithOutcome.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base text-muted-foreground">Past Appointments</CardTitle></CardHeader>
          <CardContent className="space-y-2">{pastWithOutcome.slice(0, 10).map(renderAppt)}</CardContent>
        </Card>
      )}

      {loading && <div className="text-center py-8 text-muted-foreground">Loading...</div>}
      {!loading && appts.length === 0 && <div className="text-center py-16 text-muted-foreground">No appointments yet</div>}

      {outcomeApptId && (
        <AppointmentOutcomeModal
          open={!!outcomeApptId}
          onClose={() => setOutcomeApptId(null)}
          appointmentId={outcomeApptId}
          onSuccess={fetchAppts}
        />
      )}
    </div>
  );
}
