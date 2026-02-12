import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { ClipboardList } from 'lucide-react';

interface ReferralTrackerProps {
  userId: string;
}

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'قيد الانتظار', variant: 'secondary' },
  contacted: { label: 'تم التواصل', variant: 'outline' },
  enrolled: { label: 'مسجّل', variant: 'default' },
  paid: { label: 'مدفوع', variant: 'default' },
  rejected: { label: 'مرفوض', variant: 'destructive' },
};

const ReferralTracker: React.FC<ReferralTrackerProps> = ({ userId }) => {
  const [referrals, setReferrals] = useState<any[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await (supabase as any)
        .from('referrals')
        .select('*')
        .eq('referrer_id', userId)
        .order('created_at', { ascending: false });
      if (data) setReferrals(data);
    };
    fetch();
  }, [userId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ClipboardList className="h-5 w-5 text-primary" />
          حالة الإحالات ({referrals.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {referrals.length === 0 ? (
          <p className="p-6 text-center text-muted-foreground">لم تقم بأي إحالات بعد</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-start font-semibold">الاسم</th>
                  <th className="px-4 py-3 text-start font-semibold">الحالة</th>
                  <th className="px-4 py-3 text-start font-semibold">عائلة</th>
                  <th className="px-4 py-3 text-start font-semibold">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map(r => {
                  const status = STATUS_MAP[r.status] || STATUS_MAP.pending;
                  return (
                    <tr key={r.id} className="border-b hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{r.referred_name}</td>
                      <td className="px-4 py-3"><Badge variant={status.variant}>{status.label}</Badge></td>
                      <td className="px-4 py-3">{r.is_family ? '✅ عائلة' : '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{new Date(r.created_at).toLocaleDateString('ar')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ReferralTracker;
