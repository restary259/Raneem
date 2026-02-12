import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { DollarSign } from 'lucide-react';

const PayoutsManagement: React.FC<{ onRefresh?: () => void }> = ({ onRefresh }) => {
  const { toast } = useToast();
  const [rewards, setRewards] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');

  const fetchRewards = async () => {
    const { data } = await (supabase as any)
      .from('rewards')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setRewards(data);
  };

  useEffect(() => { fetchRewards(); }, []);

  const updateRewardStatus = async (id: string, newStatus: string) => {
    const updateData: any = { status: newStatus };
    if (newStatus === 'paid') updateData.paid_at = new Date().toISOString();

    const { error } = await (supabase as any)
      .from('rewards')
      .update(updateData)
      .eq('id', id);
    
    if (error) {
      toast({ variant: 'destructive', title: 'خطأ', description: error.message });
      return;
    }
    toast({ title: 'تم تحديث حالة المكافأة' });
    fetchRewards();
    onRefresh?.();
  };

  const totalPending = rewards.filter(r => r.status === 'pending' || r.status === 'approved').reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalPaid = rewards.filter(r => r.status === 'paid').reduce((s, r) => s + Number(r.amount || 0), 0);

  const filtered = filter === 'all' ? rewards : rewards.filter(r => r.status === filter);

  const STATUS_LABELS: Record<string, string> = {
    pending: 'معلّق',
    approved: 'تمت الموافقة',
    paid: 'مدفوع',
    cancelled: 'ملغى',
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-amber-500"><DollarSign className="h-6 w-6 text-white" /></div>
            <div><p className="text-sm text-muted-foreground">معلّق / بانتظار الصرف</p><p className="text-2xl font-bold">{totalPending.toLocaleString()} ₪</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-600"><DollarSign className="h-6 w-6 text-white" /></div>
            <div><p className="text-sm text-muted-foreground">تم الصرف</p><p className="text-2xl font-bold">{totalPaid.toLocaleString()} ₪</p></div>
          </CardContent>
        </Card>
      </div>

      <Select value={filter} onValueChange={setFilter}>
        <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">الكل ({rewards.length})</SelectItem>
          <SelectItem value="pending">معلّق ({rewards.filter(r => r.status === 'pending').length})</SelectItem>
          <SelectItem value="approved">تمت الموافقة ({rewards.filter(r => r.status === 'approved').length})</SelectItem>
          <SelectItem value="paid">مدفوع ({rewards.filter(r => r.status === 'paid').length})</SelectItem>
          <SelectItem value="cancelled">ملغى ({rewards.filter(r => r.status === 'cancelled').length})</SelectItem>
        </SelectContent>
      </Select>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-start font-semibold">المبلغ</th>
                  <th className="px-4 py-3 text-start font-semibold">الحالة</th>
                  <th className="px-4 py-3 text-start font-semibold">تاريخ الطلب</th>
                  <th className="px-4 py-3 text-start font-semibold">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{Number(r.amount).toLocaleString()} ₪</td>
                    <td className="px-4 py-3">
                      <Badge variant={r.status === 'paid' ? 'default' : r.status === 'cancelled' ? 'destructive' : 'secondary'}>
                        {STATUS_LABELS[r.status] || r.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(r.created_at).toLocaleDateString('ar')}</td>
                    <td className="px-4 py-3">
                      {r.status !== 'paid' && r.status !== 'cancelled' && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="default" onClick={() => updateRewardStatus(r.id, 'paid')}>صرف</Button>
                          <Button size="sm" variant="destructive" onClick={() => updateRewardStatus(r.id, 'cancelled')}>إلغاء</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <p className="p-8 text-center text-muted-foreground">لا توجد مكافآت</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PayoutsManagement;
