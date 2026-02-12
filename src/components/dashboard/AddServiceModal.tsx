import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

interface AddServiceModalProps {
  userId: string;
  onSuccess: () => void;
}

const serviceKeys = [
  'university_application',
  'visa_assistance',
  'accommodation',
  'scholarship',
  'language_support',
  'travel_booking',
];

const AddServiceModal: React.FC<AddServiceModalProps> = ({ userId, onSuccess }) => {
  const [serviceType, setServiceType] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation('dashboard');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceType) {
      toast({ variant: "destructive", title: t('common.error'), description: t('services.selectError') });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await (supabase as any)
        .from('services')
        .insert({
          student_id: userId,
          service_type: serviceType,
          notes: notes || null,
        });

      if (error) throw error;
      toast({ title: t('services.addSuccess'), description: t('services.addSuccessDesc') });
      onSuccess();
    } catch (error: any) {
      toast({ variant: "destructive", title: t('services.addError'), description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>{t('services.serviceType')}</Label>
        <Select value={serviceType} onValueChange={setServiceType}>
          <SelectTrigger><SelectValue placeholder={t('services.selectServiceType')} /></SelectTrigger>
          <SelectContent>
            {serviceKeys.map((key) => (
              <SelectItem key={key} value={key}>{t(`services.types.${key}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>{t('services.notes')}</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('services.optionalNotes')} rows={3} />
      </div>
      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? t('services.adding') : t('services.addServiceBtn')}
      </Button>
    </form>
  );
};

export default AddServiceModal;
