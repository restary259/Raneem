
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Service {
  id: string;
  service_type: string;
}

interface AddPaymentModalProps {
  userId: string;
  onSuccess: () => void;
}

const AddPaymentModal: React.FC<AddPaymentModalProps> = ({ userId, onSuccess }) => {
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState('');
  const [amountTotal, setAmountTotal] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchServices();
  }, [userId]);

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select('id, service_type')
        .eq('student_id', userId);

      if (error) throw error;
      setServices(data || []);
    } catch (error: any) {
      console.error('Error fetching services:', error);
    }
  };

  const serviceNames = {
    university_application: 'تقديم الجامعة',
    visa_assistance: 'مساعدة الفيزا',
    accommodation: 'السكن',
    scholarship: 'المنح الدراسية',
    language_support: 'دعم اللغة',
    travel_booking: 'حجز السفر',
  };

  const paymentMethods = [
    'نقداً',
    'بطاقة ائتمان',
    'تحويل بنكي',
    'شيك',
    'محفظة إلكترونية',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amountTotal || parseFloat(amountTotal) <= 0) {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: "يرجى إدخال مبلغ صحيح",
      });
      return;
    }

    const paidAmount = parseFloat(amountPaid) || 0;
    const totalAmount = parseFloat(amountTotal);

    if (paidAmount > totalAmount) {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: "المبلغ المدفوع لا يمكن أن يكون أكبر من إجمالي المبلغ",
      });
      return;
    }

    setIsLoading(true);
    try {
      const paymentStatus = paidAmount === 0 ? 'pending' : 
                           paidAmount < totalAmount ? 'partial' : 'completed';

      const { error } = await supabase
        .from('payments')
        .insert({
          student_id: userId,
          service_id: serviceId || null,
          amount_total: totalAmount,
          amount_paid: paidAmount,
          payment_status: paymentStatus,
          payment_method: paymentMethod || null,
          notes: notes || null,
          due_date: dueDate || null,
          payment_date: paidAmount > 0 ? new Date().toISOString() : null,
        });

      if (error) throw error;

      toast({
        title: "تمت الإضافة بنجاح",
        description: "تم إضافة الدفعة الجديدة",
      });
      
      onSuccess();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "خطأ في الإضافة",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="serviceId">الخدمة (اختياري)</Label>
        <Select value={serviceId} onValueChange={setServiceId}>
          <SelectTrigger>
            <SelectValue placeholder="اختر الخدمة (اختياري)" />
          </SelectTrigger>
          <SelectContent>
            {services.map((service) => (
              <SelectItem key={service.id} value={service.id}>
                {serviceNames[service.service_type as keyof typeof serviceNames]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="amountTotal">إجمالي المبلغ (ر.س)</Label>
          <Input
            id="amountTotal"
            type="number"
            value={amountTotal}
            onChange={(e) => setAmountTotal(e.target.value)}
            placeholder="0.00"
            step="0.01"
            min="0"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="amountPaid">المبلغ المدفوع (ر.س)</Label>
          <Input
            id="amountPaid"
            type="number"
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
            placeholder="0.00"
            step="0.01"
            min="0"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="paymentMethod">طريقة الدفع</Label>
        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
          <SelectTrigger>
            <SelectValue placeholder="اختر طريقة الدفع" />
          </SelectTrigger>
          <SelectContent>
            {paymentMethods.map((method) => (
              <SelectItem key={method} value={method}>
                {method}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="dueDate">تاريخ الاستحقاق</Label>
        <Input
          id="dueDate"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">ملاحظات</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="أي ملاحظات إضافية (اختياري)"
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "جار الإضافة..." : "إضافة الدفعة"}
        </Button>
      </div>
    </form>
  );
};

export default AddPaymentModal;
