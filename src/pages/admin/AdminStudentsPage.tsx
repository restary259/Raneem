import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Search, User, Mail, Phone, ExternalLink, GraduationCap } from 'lucide-react';
import { format } from 'date-fns';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

interface StudentRecord {
  id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  created_at: string;
  case_status: string | null;
  case_id: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  appointment_scheduled: 'bg-purple-100 text-purple-800',
  profile_completion: 'bg-orange-100 text-orange-800',
  payment_confirmed: 'bg-teal-100 text-teal-800',
  submitted: 'bg-indigo-100 text-indigo-800',
  enrollment_paid: 'bg-green-100 text-green-800',
  forgotten: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function AdminStudentsPage() {
  const { toast } = useToast();
  const { t, i18n } = useTranslation('dashboard');
  const isRtl = i18n.language === 'ar';
  const navigate = useNavigate();

  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      // Get all users with 'student' role
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'student');

      if (roleError) throw roleError;

      const userIds = (roleData || []).map(r => r.user_id);
      if (userIds.length === 0) {
        setStudents([]);
        return;
      }

      // Get profiles for those users
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone_number, created_at')
        .in('id', userIds)
        .order('created_at', { ascending: false });

      if (profileError) throw profileError;

      // Get case statuses for each student
      const { data: caseData, error: caseError } = await supabase
        .from('cases')
        .select('id, student_user_id, status')
        .in('student_user_id', userIds);

      if (caseError) throw caseError;

      const caseMap: Record<string, { id: string; status: string }> = {};
      (caseData || []).forEach(c => {
        if (c.student_user_id) caseMap[c.student_user_id] = { id: c.id, status: c.status };
      });

      const merged: StudentRecord[] = (profileData || []).map(p => ({
        id: p.id,
        full_name: p.full_name || '',
        email: p.email || '',
        phone_number: p.phone_number,
        created_at: p.created_at,
        case_status: caseMap[p.id]?.status ?? null,
        case_id: caseMap[p.id]?.id ?? null,
      }));

      setStudents(merged);
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);
  useRealtimeSubscription('profiles', fetchStudents, true);
  useRealtimeSubscription('cases', fetchStudents, true);

  const filtered = students.filter(s => {
    const matchSearch = !search ||
      s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      (s.phone_number || '').includes(search);
    const matchStatus = statusFilter === 'all' || s.case_status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusLabel = (status: string | null) => {
    if (!status) return isRtl ? 'بدون ملف' : 'No Case';
    const key = `case.status.${status}`;
    return t(key, status.replace(/_/g, ' '));
  };

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">
            {isRtl ? 'الطلاب المسجلون' : 'Registered Students'}
          </h1>
          <Badge variant="secondary" className="text-xs">{students.length}</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStudents} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          {t('common.refresh', 'Refresh')}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={isRtl ? 'بحث بالاسم أو البريد أو الهاتف...' : 'Search by name, email or phone...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="ps-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={isRtl ? 'تصفية بالحالة' : 'Filter by status'} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isRtl ? 'الكل' : 'All'}</SelectItem>
            <SelectItem value="new">{isRtl ? 'جديد' : 'New'}</SelectItem>
            <SelectItem value="profile_completion">{isRtl ? 'استكمال الملف' : 'Profile Completion'}</SelectItem>
            <SelectItem value="payment_confirmed">{isRtl ? 'تأكيد الدفع' : 'Payment Confirmed'}</SelectItem>
            <SelectItem value="submitted">{isRtl ? 'مقدّم' : 'Submitted'}</SelectItem>
            <SelectItem value="enrollment_paid">{isRtl ? 'مسجّل' : 'Enrolled'}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <GraduationCap className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>{isRtl ? 'لا يوجد طلاب مسجلون' : 'No registered students found'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => (
            <Card
              key={s.id}
              className="cursor-pointer hover:shadow-md transition-shadow border-border"
              onClick={() => s.case_id && navigate(`/team/cases/${s.case_id}`)}
            >
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{s.full_name}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        <span className="truncate max-w-[160px]">{s.email}</span>
                      </span>
                      {s.phone_number && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {s.phone_number}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-muted-foreground hidden sm:block">
                    {format(new Date(s.created_at), 'dd MMM yyyy')}
                  </span>
                  <Badge className={`text-xs ${STATUS_COLORS[s.case_status || ''] || 'bg-muted text-muted-foreground'}`}>
                    {statusLabel(s.case_status)}
                  </Badge>
                  {s.case_id && (
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
