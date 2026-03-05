import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Users, Search } from 'lucide-react';
import DashboardLoading from '@/components/dashboard/DashboardLoading';
import { useDirection } from '@/hooks/useDirection';

const STATUS_COLORS: Record<string, string> = {
  new:              'bg-muted text-muted-foreground',
  contacted:        'bg-blue-100 text-blue-800',
  appointment_scheduled: 'bg-purple-100 text-purple-800',
  profile_completion: 'bg-yellow-100 text-yellow-800',
  payment_confirmed: 'bg-amber-100 text-amber-800',
  submitted:        'bg-cyan-100 text-cyan-800',
  enrollment_paid:  'bg-green-100 text-green-800',
  cancelled:        'bg-red-100 text-red-800',
};

export default function PartnerStudentsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [cases, setCases] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation('dashboard');
  const { dir } = useDirection();
  const isAr = i18n.language === 'ar';

  const load = useCallback(async (uid: string) => {
    const { data } = await (supabase as any)
      .from('cases')
      .select('id,full_name,status,created_at,phone_number')
      .eq('partner_id', uid)
      .order('created_at', { ascending: false });
    setCases(data || []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) { navigate('/student-auth'); return; }
      setUserId(session.user.id);
      load(session.user.id);
    });
  }, [navigate, load]);

  if (!userId || isLoading) return <DashboardLoading />;

  const filtered = cases.filter((c) =>
    c.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      new: t('partner.status.new', 'New'),
      contacted: t('partner.status.contacted', 'Contacted'),
      appointment_scheduled: t('partner.status.appointment', 'Appointment'),
      profile_completion: t('partner.status.profile', 'Profile'),
      payment_confirmed: t('partner.status.payment', 'Payment'),
      submitted: t('partner.status.submitted', 'Submitted'),
      enrollment_paid: t('partner.status.paid', 'Paid ✅'),
      cancelled: t('partner.status.cancelled', 'Cancelled'),
    };
    return map[s] || s;
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" dir={dir}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          {t('partner.studentsTitle', 'My Students')}
          <span className="text-base font-normal text-muted-foreground">({cases.length})</span>
        </h1>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('partner.searchPlaceholder', 'Search by name...')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ps-9"
        />
      </div>

      {/* Status summary chips */}
      <div className="flex flex-wrap gap-2">
        {(['enrollment_paid', 'submitted', 'appointment_scheduled', 'new'] as const).map((s) => {
          const count = cases.filter((c) => c.status === s).length;
          if (!count) return null;
          return (
            <span key={s} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[s] || 'bg-muted text-muted-foreground'}`}>
              {statusLabel(s)}: {count}
            </span>
          );
        })}
      </div>

      {/* List */}
      {filtered.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {search ? t('partner.noResults', 'No matching students') : t('partner.noStudents', 'No students referred yet. Share your link to get started!')}
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {filtered.map((c) => (
          <Card key={c.id} className="hover:shadow-sm transition-shadow">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-foreground text-sm">{c.full_name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(c.created_at).toLocaleDateString(isAr ? 'ar' : 'en-GB')}
                </p>
              </div>
              <Badge className={`text-xs shrink-0 ${STATUS_COLORS[c.status] || 'bg-muted text-muted-foreground'}`}>
                {statusLabel(c.status)}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
