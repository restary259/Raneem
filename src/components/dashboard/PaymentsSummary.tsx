
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
  amount_total: number;
  amount_paid: number;
  amount_remaining: number;
  payment_status: string;
  due_date?: string;
  payment_date?: string;
  payment_method?: string;
  notes?: string;
  service_id?: string;
  service_type?: string;
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
      // First fetch payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select('*')
        .eq('student_id', userId)
        .order('created_at', { ascending: false });

      if (paymentsError) throw paymentsError;

      // Then fetch services separately and merge
      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select('id, service_type')
        .eq('student_id', userId);

      if (servicesError) throw servicesError;

      // Create a map of service_id to service_type
      const serviceMap = new Map(servicesData?.map(s => [s.id, s.service_type]) || []);

      // Merge the data
      const enrichedPayments = paymentsData?.map(payment => ({
        ...payment,
        service_type: payment.service_id ? serviceMap.get(payment.service_id) : undefined
      })) || [];

      setPayments(enrichedPayments);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "خطأ في تحميل المدفوعات",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      pending: { label: 'في الانتظار', variant: 'secondary' as const },
      partial: { label: 'جزئي', variant: 'outline' as const },
      completed: { label: 'مكتمل', variant: 'default' as const },
      overdue: { label: 'متأخر', variant: 'destructive' as const },
    };
    
    return statusMap[status as keyof typeof statusMap] || { label: status, variant: 'secondary' as const };
  };

  const serviceNames = {
    university_application: 'تقديم الجامعة',
    visa_assistance: 'مساعدة الفيزا',
    accommodation: 'السكن',
    scholarship: 'المنح الدراسية',
    language_support: 'دعم اللغة',
    travel_booking: 'حجز السفر',
  };

  const totalAmount = payments.reduce((sum, payment) => sum + payment.amount_total, 0);
  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount_paid, 0);
  const totalRemaining = payments.reduce((sum, payment) => sum + payment.amount_remaining, 0);

  if (isLoading) {
    return <div className="text-center py-8">جار تحميل المدفوعات...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <CreditCard className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">إجمالي المبلغ</p>
                <p className="text-xl font-bold">{totalAmount.toLocaleString()} ر.س</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CreditCard className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">المدفوع</p>
                <p className="text-xl font-bold text-green-600">{totalPaid.toLocaleString()} ر.س</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <CreditCard className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">المتبقي</p>
                <p className="text-xl font-bold text-orange-600">{totalRemaining.toLocaleString()} ر.س</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payments List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl">تفاصيل المدفوعات</CardTitle>
          <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                إضافة دفعة
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>إضافة دفعة جديدة</DialogTitle>
              </DialogHeader>
              <AddPaymentModal
                userId={userId}
                onSuccess={() => {
                  setShowAddModal(false);
                  fetchPayments();
                }}
              />
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              لا توجد مدفوعات مسجلة
            </div>
          ) : (
            <div className="space-y-4">
              {payments.map((payment) => {
                const statusInfo = getStatusBadge(payment.payment_status);
                
                return (
                  <Card key={payment.id} className="border border-gray-200">
                    <CardContent className="p-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={statusInfo.variant}>
                              {statusInfo.label}
                            </Badge>
                            {payment.service_type && (
                              <span className="text-sm text-gray-600">
                                {serviceNames[payment.service_type as keyof typeof serviceNames]}
                              </span>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-gray-600">إجمالي المبلغ</p>
                              <p className="font-medium">{payment.amount_total.toLocaleString()} ر.س</p>
                            </div>
                            <div>
                              <p className="text-gray-600">المدفوع</p>
                              <p className="font-medium text-green-600">{payment.amount_paid.toLocaleString()} ر.س</p>
                            </div>
                            <div>
                              <p className="text-gray-600">المتبقي</p>
                              <p className="font-medium text-orange-600">{payment.amount_remaining.toLocaleString()} ر.س</p>
                            </div>
                            <div>
                              <p className="text-gray-600">طريقة الدفع</p>
                              <p className="font-medium">{payment.payment_method || 'غير محدد'}</p>
                            </div>
                          </div>

                          {payment.due_date && (
                            <div className="text-sm">
                              <span className="text-gray-600">تاريخ الاستحقاق: </span>
                              <span>{new Date(payment.due_date).toLocaleDateString('ar-SA')}</span>
                            </div>
                          )}

                          {payment.notes && (
                            <div className="text-sm">
                              <span className="text-gray-600">ملاحظات: </span>
                              <span>{payment.notes}</span>
                            </div>
                          )}
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
