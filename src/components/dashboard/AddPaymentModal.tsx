
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
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchServices();
  }, [userId]);

  const fetchServices = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('services')
        .select('id, service_type')
        .eq('student_id', userId);
      if (error) throw error;
      setServices(data || []);
    } catch (error: any) {
      console.error('Error fetching services:', error);
    }
  };

  const serviceNames: Record<string, string> = {
    university_application: 'تقديم الجامعة',
    visa_assistance: 'مساعدة الفيزا',
    accommodation: 'السكن',
    scholarship: 'المنح الدراسية',
    language_support: 'دعم اللغة',
    travel_booking: 'حجز السفر',
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      toast({ variant: "destructive", title: "خطأ", description: "يرجى إدخال مبلغ صحيح" });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await (supabase as any)
        .from('payments')
        .insert({
          student_id: userId,
          service_id: serviceId || null,
          amount: parseFloat(amount),
          notes: notes || null,
          payment_date: new Date().toISOString(),
        });

      if (error) throw error;
      toast({ title: "تمت الإضافة بنجاح", description: "تم إضافة الدفعة الجديدة" });
      onSuccess();
    } catch (error: any) {
      toast({ variant: "destructive", title: "خطأ في الإضافة", description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>الخدمة (اختياري)</Label>
        <Select value={serviceId} onValueChange={setServiceId}>
          <SelectTrigger><SelectValue placeholder="اختر الخدمة (اختياري)" /></SelectTrigger>
          <SelectContent>
            {services.map((s) => (
              <SelectItem key={s.id} value={s.id}>{serviceNames[s.service_type] || s.service_type}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>المبلغ</Label>
        <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" step="0.01" min="0" required />
      </div>
      <div className="space-y-2">
        <Label>ملاحظات</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات اختيارية" rows={3} />
      </div>
      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? "جار الإضافة..." : "إضافة الدفعة"}
      </Button>
    </form>
  );
};

export default AddPaymentModal;
