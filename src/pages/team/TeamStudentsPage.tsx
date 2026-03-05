import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Phone } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Case {
  id: string; full_name: string; phone_number: string; status: string; last_activity_at: string;
}

export default function TeamStudentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cases, setCases] = useState<Case[]>([]);
  const [tab, setTab] = useState<'submitted' | 'enrolled'>('submitted');
  const [loading, setLoading] = useState(true);

  const fetchStudents = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const statuses = tab === 'submitted' ? ['submitted'] : ['enrollment_paid'];
    const { data } = await supabase.from('cases').select('*').eq('assigned_to', user.id).in('status', statuses).order('last_activity_at', { ascending: false });
    setCases((data as Case[]) ?? []);
    setLoading(false);
  }, [user, tab]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  return (
    <div className="p-6 space-y-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold">Students</h1>
      <Tabs value={tab} onValueChange={v => setTab(v as 'submitted' | 'enrolled')}>
        <TabsList>
          <TabsTrigger value="submitted">Submitted</TabsTrigger>
          <TabsTrigger value="enrolled">Enrolled</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground">Loading...</div>
      ) : cases.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No students in this category</div>
      ) : (
        <div className="space-y-2">
          {cases.map(c => (
            <Card key={c.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/team/students/${c.id}`)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">{c.full_name}</div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" />{c.phone_number}
                      <span className="mx-1">·</span>
                      {formatDistanceToNow(new Date(c.last_activity_at), { addSuffix: true })}
                    </div>
                  </div>
                </div>
                <Badge className={c.status === 'enrollment_paid' ? 'bg-green-100 text-green-800' : 'bg-teal-100 text-teal-800'}>
                  {c.status === 'enrollment_paid' ? 'Enrolled' : 'Submitted'}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
