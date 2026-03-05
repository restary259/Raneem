import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { User, Phone, GraduationCap, RefreshCw, Clock, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Case {
  id: string;
  full_name: string;
  phone_number: string;
  status: string;
  last_activity_at: string;
  degree_interest: string | null;
}

export default function TeamStudentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { i18n } = useTranslation('dashboard');
  const isRtl = i18n.language === 'ar';

  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStudents = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cases')
        .select('id, full_name, phone_number, status, last_activity_at, degree_interest')
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
        <Button variant="outline" size="sm" onClick={fetchStudents} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          {isRtl ? 'تحديث' : 'Refresh'}
        </Button>
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
                {getStatusBadge(c.status)}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
