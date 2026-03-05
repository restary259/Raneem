import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Phone, GraduationCap, RefreshCw, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Case {
  id: string;
  full_name: string;
  phone_number: string;
  status: string;
  last_activity_at: string;
}

type TabValue = 'ready' | 'enrolled';

const STATUS_COLORS: Record<string, string> = {
  profile_completion: 'bg-orange-100 text-orange-800',
  payment_confirmed: 'bg-teal-100 text-teal-800',
  submitted: 'bg-indigo-100 text-indigo-800',
  enrollment_paid: 'bg-green-100 text-green-800',
};

export default function TeamStudentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation('dashboard');
  const isRtl = i18n.language === 'ar';

  const [cases, setCases] = useState<Case[]>([]);
  const [tab, setTab] = useState<TabValue>('ready');
  const [loading, setLoading] = useState(true);

  const fetchStudents = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // "Ready to Apply" = cases in profile_completion, payment_confirmed, or submitted
      // "Enrolled" = enrollment_paid
      const statuses: string[] = tab === 'ready'
        ? ['profile_completion', 'payment_confirmed', 'submitted']
        : ['enrollment_paid'];

      const { data, error } = await supabase
        .from('cases')
        .select('id, full_name, phone_number, status, last_activity_at')
        .eq('assigned_to', user.id)
        .in('status', statuses)
        .order('last_activity_at', { ascending: false });

      if (error) throw error;
      setCases((data as Case[]) ?? []);
    } catch (err: any) {
      console.error('Error fetching students:', err.message);
    } finally {
      setLoading(false);
    }
  }, [user, tab]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  const statusLabel = (status: string) => {
    const key = `case.status.${status}`;
    return t(key, status.replace(/_/g, ' '));
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
          {t('common.refresh', 'Refresh')}
        </Button>
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v as TabValue)}>
        <TabsList>
          <TabsTrigger value="ready">
            {isRtl ? 'جاهزون للتقديم' : 'Ready to Apply'}
          </TabsTrigger>
          <TabsTrigger value="enrolled">
            {isRtl ? 'مسجّلون' : 'Enrolled'}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : cases.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <GraduationCap className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>{isRtl ? 'لا يوجد طلاب في هذه الفئة' : 'No students in this category'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {cases.map(c => (
            <Card
              key={c.id}
              className="cursor-pointer hover:shadow-md transition-shadow border-border"
              onClick={() => navigate(`/team/cases/${c.id}`)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium text-sm">{c.full_name}</div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {c.phone_number}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(c.last_activity_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
                <Badge className={`text-xs ${STATUS_COLORS[c.status] || 'bg-muted text-muted-foreground'}`}>
                  {statusLabel(c.status)}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
