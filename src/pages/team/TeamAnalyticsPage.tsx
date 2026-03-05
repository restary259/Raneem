import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { startOfMonth, endOfMonth, isToday } from 'date-fns';
import { TrendingUp, Users, Calendar } from 'lucide-react';

export default function TeamAnalyticsPage() {
  const { user } = useAuth();
  const [caseCounts, setCaseCounts] = useState<Record<string, number>>({});
  const [closedThisMonth, setClosedThisMonth] = useState(0);
  const [todayAppts, setTodayAppts] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const monthStart = startOfMonth(new Date()).toISOString();
    const monthEnd = endOfMonth(new Date()).toISOString();
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

    const [casesRes, closedRes, apptRes] = await Promise.all([
      supabase.from('cases').select('status').eq('assigned_to', user.id),
      supabase.from('cases').select('id').eq('assigned_to', user.id).in('status', ['submitted', 'enrollment_paid']).gte('updated_at', monthStart).lte('updated_at', monthEnd),
      supabase.from('appointments').select('id').eq('team_member_id', user.id).gte('scheduled_at', todayStart.toISOString()).lte('scheduled_at', todayEnd.toISOString()),
    ]);

    const counts: Record<string, number> = {};
    for (const c of casesRes.data ?? []) counts[c.status] = (counts[c.status] ?? 0) + 1;
    setCaseCounts(counts);
    setClosedThisMonth(closedRes.data?.length ?? 0);
    setTodayAppts(apptRes.data?.length ?? 0);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const chartData = Object.entries(caseCounts).map(([status, count]) => ({ status: status.replace(/_/g, ' '), count }));
  const COLORS = ['hsl(217,100%,60%)', 'hsl(50,100%,50%)', 'hsl(270,100%,65%)', 'hsl(25,100%,55%)', 'hsl(140,70%,45%)', 'hsl(185,100%,50%)', 'hsl(0,100%,55%)'];

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold">My Analytics</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2"><TrendingUp className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">Closed This Month</span></div>
            <div className="text-3xl font-bold">{closedThisMonth}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2"><Users className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">Total Cases</span></div>
            <div className="text-3xl font-bold">{Object.values(caseCounts).reduce((a, b) => a + b, 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-2"><Calendar className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">Today's Appointments</span></div>
            <div className="text-3xl font-bold">{todayAppts}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Cases by Status</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">Loading...</div>
          ) : chartData.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <XAxis dataKey="status" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
