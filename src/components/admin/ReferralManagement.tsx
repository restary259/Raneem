import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Share2 } from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'قيد الانتظار' },
  { value: 'contacted', label: 'تم التواصل' },
  { value: 'enrolled', label: 'مسجّل' },
  { value: 'paid', label: 'مدفوع' },
  { value: 'rejected', label: 'مرفوض' },
];

const STATUS_COLORS: Record<string, string> = {
  pending: 'secondary',
  contacted: 'outline',
  enrolled: 'default',
  paid: 'default',
  rejected: 'destructive',
};

const ReferralManagement: React.FC<{ onRefresh?: () => void }> = ({ onRefresh }) => {
  const { toast } = useToast();
  const [referrals, setReferrals] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');

  const fetchReferrals = async () => {
    const { data } = await (supabase as any)
      .from('referrals')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setReferrals(data);
  };

  useEffect(() => { fetchReferrals(); }, []);

  const updateStatus = async (id: string, newStatus: string, referral: any) => {
    const { error } = await (supabase as any)
      .from('referrals')
      .update({ status: newStatus })
      .eq('id', id);
    
    if (error) {
      toast({ variant: 'destructive', title: 'خطأ', description: error.message });
      return;
    }

    // Auto-create reward when status changes to 'paid'
    if (newStatus === 'paid') {
      const amount = referral.referrer_type === 'influencer' ? 2000 : 500;
      await (supabase as any).from('rewards').insert({
        user_id: referral.referrer_id,
        referral_id: id,
        amount,
        currency: 'ILS',
        status: 'pending',
      });

      // Check milestones
      const { data: allReferrals } = await (supabase as any)
        .from('referrals')
        .select('id')
        .eq('referrer_id', referral.referrer_id)
        .eq('status', 'paid');
      
      const count = allReferrals?.length || 0;
      const milestoneMap: Record<number, string> = { 1: 'first_referral', 5: '5_referrals', 10: '10_referrals' };
      
      if (milestoneMap[count]) {
        const { data: existing } = await (supabase as any)
          .from('referral_milestones')
          .select('id')
          .eq('user_id', referral.referrer_id)
          .eq('milestone_type', milestoneMap[count]);
        
        if (!existing?.length) {
          await (supabase as any).from('referral_milestones').insert({
            user_id: referral.referrer_id,
            milestone_type: milestoneMap[count],
          });
        }
      }
    }

    toast({ title: 'تم تحديث الحالة' });
    fetchReferrals();
    onRefresh?.();
  };

  const filtered = filter === 'all' ? referrals : referrals.filter(r => r.status === filter);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل ({referrals.length})</SelectItem>
            {STATUS_OPTIONS.map(s => (
              <SelectItem key={s.value} value={s.value}>
                {s.label} ({referrals.filter(r => r.status === s.value).length})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-start font-semibold">الاسم</th>
                  <th className="px-4 py-3 text-start font-semibold">النوع</th>
                  <th className="px-4 py-3 text-start font-semibold">البريد</th>
                  <th className="px-4 py-3 text-start font-semibold">عائلة</th>
                  <th className="px-4 py-3 text-start font-semibold">الحالة</th>
                  <th className="px-4 py-3 text-start font-semibold">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{r.referred_name}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{r.referrer_type === 'influencer' ? 'وكيل' : 'طالب'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.referred_email || '—'}</td>
                    <td className="px-4 py-3">{r.is_family ? '✅' : '—'}</td>
                    <td className="px-4 py-3">
                      <Select value={r.status} onValueChange={(v) => updateStatus(r.id, v, r)}>
                        <SelectTrigger className="w-36 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map(s => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(r.created_at).toLocaleDateString('ar')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <p className="p-8 text-center text-muted-foreground">لا توجد إحالات</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReferralManagement;
