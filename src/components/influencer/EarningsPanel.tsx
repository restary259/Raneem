import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { DollarSign, Gift } from 'lucide-react';

interface EarningsPanelProps {
  userId: string;
}

const EarningsPanel: React.FC<EarningsPanelProps> = ({ userId }) => {
  const { toast } = useToast();
  const [rewards, setRewards] = useState<any[]>([]);

  const fetchRewards = async () => {
    const { data } = await (supabase as any)
      .from('rewards')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (data) setRewards(data);
  };

  useEffect(() => { fetchRewards(); }, [userId]);

  const totalEarned = rewards.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const pendingAmount = rewards.filter(r => r.status === 'pending' || r.status === 'approved').reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const paidAmount = rewards.filter(r => r.status === 'paid').reduce((sum, r) => sum + Number(r.amount || 0), 0);

  const requestPayout = async () => {
    const pendingRewards = rewards.filter(r => r.status === 'pending');
    if (!pendingRewards.length) {
      toast({ title: 'لا توجد مكافآت معلقة' });
      return;
    }
    for (const r of pendingRewards) {
      await (supabase as any).from('rewards').update({
        status: 'approved',
        payout_requested_at: new Date().toISOString(),
      }).eq('id', r.id);
    }
    toast({ title: 'تم طلب الصرف بنجاح!' });
    fetchRewards();
  };

  const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    pending: { label: 'معلّق', variant: 'secondary' },
    approved: { label: 'تمت الموافقة', variant: 'outline' },
    paid: { label: 'مدفوع', variant: 'default' },
    cancelled: { label: 'ملغى', variant: 'destructive' },
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-600"><DollarSign className="h-6 w-6 text-white" /></div>
            <div><p className="text-sm text-muted-foreground">إجمالي الأرباح</p><p className="text-2xl font-bold">{totalEarned.toLocaleString()} ₪</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-amber-500"><Gift className="h-6 w-6 text-white" /></div>
            <div><p className="text-sm text-muted-foreground">معلّق</p><p className="text-2xl font-bold">{pendingAmount.toLocaleString()} ₪</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-600"><DollarSign className="h-6 w-6 text-white" /></div>
            <div><p className="text-sm text-muted-foreground">مدفوع</p><p className="text-2xl font-bold">{paidAmount.toLocaleString()} ₪</p></div>
          </CardContent>
        </Card>
      </div>

      <Button onClick={requestPayout}>طلب صرف المكافآت المعلّقة</Button>

      <Card>
        <CardHeader><CardTitle className="text-lg">سجل الأرباح</CardTitle></CardHeader>
        <CardContent className="p-0">
          {rewards.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">لا توجد أرباح بعد</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-start font-semibold">المبلغ</th>
                    <th className="px-4 py-3 text-start font-semibold">الحالة</th>
                    <th className="px-4 py-3 text-start font-semibold">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {rewards.map(r => {
                    const st = STATUS_LABELS[r.status] || STATUS_LABELS.pending;
                    return (
                      <tr key={r.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{Number(r.amount).toLocaleString()} ₪</td>
                        <td className="px-4 py-3"><Badge variant={st.variant}>{st.label}</Badge></td>
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
    </div>
  );
};

export default EarningsPanel;
