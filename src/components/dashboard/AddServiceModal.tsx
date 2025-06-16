
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AddServiceModalProps {
  userId: string;
  onSuccess: () => void;
}

const AddServiceModal: React.FC<AddServiceModalProps> = ({ userId, onSuccess }) => {
  const [serviceType, setServiceType] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const serviceTypes = [
    { value: 'university_application', label: 'تقديم الجامعة' },
    { value: 'visa_assistance', label: 'مساعدة الفيزا' },
    { value: 'accommodation', label: 'السكن' },
    { value: 'scholarship', label: 'المنح الدراسية' },
    { value: 'language_support', label: 'دعم اللغة' },
    { value: 'travel_booking', label: 'حجز السفر' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceType) {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: "يرجى اختيار نوع الخدمة",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('services')
        .insert({
          student_id: userId,
          service_type: serviceType,
          description: description || null,
          notes: notes || null,
        });

      if (error) throw error;

      toast({
        title: "تمت الإضافة بنجاح",
        description: "تم إضافة الخدمة الجديدة",
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
        <Label htmlFor="serviceType">نوع الخدمة</Label>
        <Select value={serviceType} onValueChange={setServiceType} required>
          <SelectTrigger>
            <SelectValue placeholder="اختر نوع الخدمة" />
          </SelectTrigger>
          <SelectContent>
            {serviceTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">الوصف</Label>
        <Input
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="وصف الخدمة (اختياري)"
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
          {isLoading ? "جار الإضافة..." : "إضافة الخدمة"}
        </Button>
      </div>
    </form>
  );
};

export default AddServiceModal;
