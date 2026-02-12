import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation('dashboard');

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      toast({ variant: "destructive", title: t('common.error'), description: t('payments.invalidAmount') });
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
      toast({ title: t('payments.addSuccess'), description: t('payments.addSuccessDesc') });
      onSuccess();
    } catch (error: any) {
      toast({ variant: "destructive", title: t('payments.addError'), description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>{t('payments.serviceOptional')}</Label>
        <Select value={serviceId} onValueChange={setServiceId}>
          <SelectTrigger><SelectValue placeholder={t('payments.selectServiceOptional')} /></SelectTrigger>
          <SelectContent>
            {services.map((s) => (
              <SelectItem key={s.id} value={s.id}>{t(`services.types.${s.service_type}`, s.service_type)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>{t('payments.amount')}</Label>
        <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" step="0.01" min="0" required />
      </div>
      <div className="space-y-2">
        <Label>{t('payments.notes')}</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('payments.optionalNotes')} rows={3} />
      </div>
      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? t('payments.adding') : t('payments.addPaymentBtn')}
      </Button>
    </form>
  );
};

export default AddPaymentModal;
