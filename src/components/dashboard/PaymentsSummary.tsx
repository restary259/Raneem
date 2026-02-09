
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, CreditCard } from 'lucide-react';
import AddPaymentModal from './AddPaymentModal';

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  payment_date?: string;
  notes?: string;
  service_id?: string;
  created_at: string;
}

interface PaymentsSummaryProps {
  userId: string;
}

const PaymentsSummary: React.FC<PaymentsSummaryProps> = ({ userId }) => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchPayments();
  }, [userId]);

  const fetchPayments = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('payments')
        .select('*')
        .eq('student_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPayments(data || []);
    } catch (error: any) {
      toast({ variant: "destructive", title: "خطأ في تحميل المدفوعات", description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      pending: { label: 'في الانتظار', variant: 'secondary' },
      completed: { label: 'مكتمل', variant: 'default' },
    };
    return map[status] || { label: status, variant: 'secondary' as const };
  };

  const totalAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

  if (isLoading) return <div className="text-center py-8">جار تحميل المدفوعات...</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <CreditCard className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">إجمالي المدفوعات</p>
              <p className="text-xl font-bold">{totalAmount.toLocaleString()} ₪</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl">تفاصيل المدفوعات</CardTitle>
          <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2"><Plus className="h-4 w-4" />إضافة دفعة</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>إضافة دفعة جديدة</DialogTitle></DialogHeader>
              <AddPaymentModal userId={userId} onSuccess={() => { setShowAddModal(false); fetchPayments(); }} />
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">لا توجد مدفوعات مسجلة</div>
          ) : (
            <div className="space-y-3">
              {payments.map((payment) => {
                const statusInfo = getStatusBadge(payment.status);
                return (
                  <Card key={payment.id} className="border border-gray-200">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                          <p className="font-medium mt-1">{(payment.amount || 0).toLocaleString()} {payment.currency}</p>
                          {payment.notes && <p className="text-xs text-gray-500 mt-1">{payment.notes}</p>}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(payment.created_at).toLocaleDateString('ar-SA')}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentsSummary;
