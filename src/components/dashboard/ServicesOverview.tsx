import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, GraduationCap, Plane, Home, Award, Languages, MapPin } from 'lucide-react';
import AddServiceModal from './AddServiceModal';
import { useTranslation } from 'react-i18next';

interface Service {
  id: string;
  service_type: string;
  status: string;
  notes?: string;
  created_at: string;
}

interface ServicesOverviewProps {
  userId: string;
}

const ServicesOverview: React.FC<ServicesOverviewProps> = ({ userId }) => {
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const { toast } = useToast();
  const { t, i18n } = useTranslation('dashboard');

  useEffect(() => {
    fetchServices();
  }, [userId]);

  const fetchServices = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('services')
        .select('*')
        .eq('student_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setServices(data || []);
    } catch (error: any) {
      toast({ variant: "destructive", title: t('services.loadError'), description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const serviceIcons: Record<string, any> = {
    university_application: GraduationCap,
    visa_assistance: Plane,
    accommodation: Home,
    scholarship: Award,
    language_support: Languages,
    travel_booking: MapPin,
  };

  if (isLoading) return <div className="text-center py-8">{t('services.loading')}</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl">{t('services.title')}</CardTitle>
          <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2"><Plus className="h-4 w-4" />{t('services.addService')}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t('services.addNewService')}</DialogTitle></DialogHeader>
              <AddServiceModal userId={userId} onSuccess={() => { setShowAddModal(false); fetchServices(); }} />
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {services.length === 0 ? (
            <div className="text-center py-8 text-gray-500">{t('services.noServices')}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map((service) => {
                const Icon = serviceIcons[service.service_type] || GraduationCap;
                return (
                  <Card key={service.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Icon className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-medium text-sm">{t(`services.types.${service.service_type}`, service.service_type)}</h3>
                          <Badge variant={service.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                            {t(`services.status.${service.status}`, service.status)}
                          </Badge>
                        </div>
                      </div>
                      {service.notes && <p className="text-xs text-gray-600 line-clamp-2">{service.notes}</p>}
                      <p className="text-xs text-gray-400 mt-2">{new Date(service.created_at).toLocaleDateString(i18n.language === 'ar' ? 'ar-SA' : 'en-US')}</p>
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

export default ServicesOverview;
