import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { RefreshCw } from 'lucide-react';

const STATUSES = ['new', 'contacted', 'appointment_scheduled', 'profile_completion', 'payment_confirmed', 'submitted', 'enrollment_paid', 'forgotten', 'cancelled'];
const STATUS_COLORS = ['#6366f1', '#f59e0b', '#8b5cf6', '#f97316', '#14b8a6', '#3b82f6', '#22c55e', '#ef4444', '#94a3b8'];
const SOURCES = ['apply_page', 'manual', 'submit_new_student', 'social_media_partner'];

const AdminAnalyticsPage = () => {
  const { t, i18n } = useTranslation('dashboard');
  const { toast } = useToast();
  const isRtl = i18n.language === 'ar';

  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('cases').select('status, source, created_at, last_activity_at');
      if (error) throw error;
      setCases(data || []);
    } catch (err: any) {
      toast({ variant: 'destructive', description: err.message });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const statusLabels: Record<string, string> = {
    new: isRtl ? 'جديد' : 'New',
    contacted: isRtl ? 'تواصل' : 'Contacted',
    appointment_scheduled: isRtl ? 'موعد' : 'Appt',
    profile_completion: isRtl ? 'ملف' : 'Profile',
    payment_confirmed: isRtl ? 'دفع' : 'Payment',
    submitted: isRtl ? 'تقديم' : 'Submitted',
    enrollment_paid: isRtl ? 'مسجل' : 'Enrolled',
    forgotten: isRtl ? 'منسي' : 'Forgotten',
    cancelled: isRtl ? 'ملغى' : 'Cancelled',
  };

  const funnelData = STATUSES.map((s, i) => ({
    name: statusLabels[s] || s,
    count: cases.filter(c => c.status === s).length,
    fill: STATUS_COLORS[i],
  }));

  const sourceData = SOURCES.map(s => ({
    name: s.replace(/_/g, ' '),
    count: cases.filter(c => c.source === s).length,
  })).filter(s => s.count > 0);

  // Avg days per stage (rough estimate from created_at vs last_activity_at)
  const avgDays = STATUSES.slice(0, 7).map(s => {
    const group = cases.filter(c => c.status === s);
    if (group.length === 0) return { name: statusLabels[s], avg: 0 };
    const avg = group.reduce((sum, c) => {
      const diff = (new Date(c.last_activity_at).getTime() - new Date(c.created_at).getTime()) / 86400000;
      return sum + Math.max(0, diff);
    }, 0) / group.length;
    return { name: statusLabels[s], avg: Math.round(avg) };
  });

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t('admin.analytics.title', 'Analytics')}</h1>
        <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Funnel */}
        <Card>
          <CardHeader><CardTitle className="text-base">{isRtl ? 'قمع التحويل' : 'Conversion Funnel'}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={funnelData} layout="vertical">
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [v, isRtl ? 'عدد' : 'Cases']} />
                <Bar dataKey="count" radius={4}>
                  {funnelData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Source breakdown */}
        <Card>
          <CardHeader><CardTitle className="text-base">{isRtl ? 'توزيع المصادر' : 'Source Breakdown'}</CardTitle></CardHeader>
          <CardContent>
            {sourceData.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">{isRtl ? 'لا توجد بيانات' : 'No data yet'}</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={sourceData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={e => `${e.name}: ${e.count}`}>
                    {sourceData.map((_, i) => <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Avg days per stage */}
        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-base">{isRtl ? 'متوسط الأيام في كل مرحلة' : 'Average Days Per Stage'}</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={avgDays}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v} ${isRtl ? 'يوم' : 'days'}`, '']} />
                <Bar dataKey="avg" fill="hsl(var(--primary))" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminAnalyticsPage;
