
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, GraduationCap, Plane, Home, Award, Languages, MapPin } from 'lucide-react';
import AddServiceModal from './AddServiceModal';

interface Service {
  id: string;
  service_type: string;
  description?: string;
  status: string;
  assigned_date: string;
  completion_date?: string;
  notes?: string;
  payments?: Array<{
    amount_total: number;
    amount_paid: number;
    payment_status: string;
  }>;
}

interface ServicesOverviewProps {
  userId: string;
}

const ServicesOverview: React.FC<ServicesOverviewProps> = ({ userId }) => {
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchServices();
  }, [userId]);

  const fetchServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select(`
          *,
          payments (
            amount_total,
            amount_paid,
            payment_status
          )
        `)
        .eq('student_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setServices(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "خطأ في تحميل الخدمات",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const serviceIcons = {
    university_application: GraduationCap,
    visa_assistance: Plane,
    accommodation: Home,
    scholarship: Award,
    language_support: Languages,
    travel_booking: MapPin,
  };

  const serviceNames = {
    university_application: 'تقديم الجامعة',
    visa_assistance: 'مساعدة الفيزا',
    accommodation: 'السكن',
    scholarship: 'المنح الدراسية',
    language_support: 'دعم اللغة',
    travel_booking: 'حجز السفر',
  };

  const getServicePaymentInfo = (service: Service) => {
    if (!service.payments || service.payments.length === 0) {
      return { totalPaid: 0, totalAmount: 0, status: 'لا توجد مدفوعات' };
    }

    const totalPaid = service.payments.reduce((sum, payment) => sum + payment.amount_paid, 0);
    const totalAmount = service.payments.reduce((sum, payment) => sum + payment.amount_total, 0);
    
    return {
      totalPaid,
      totalAmount,
      status: totalPaid >= totalAmount ? 'مكتمل' : 'جاري',
    };
  };

  if (isLoading) {
    return <div className="text-center py-8">جار تحميل الخدمات...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl">خدماتي</CardTitle>
          <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                إضافة خدمة
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>إضافة خدمة جديدة</DialogTitle>
              </DialogHeader>
              <AddServiceModal
                userId={userId}
                onSuccess={() => {
                  setShowAddModal(false);
                  fetchServices();
                }}
              />
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {services.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              لم يتم إضافة أي خدمات بعد
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map((service) => {
                const Icon = serviceIcons[service.service_type as keyof typeof serviceIcons] || GraduationCap;
                const paymentInfo = getServicePaymentInfo(service);
                
                return (
                  <TooltipProvider key={service.id}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Card className="cursor-pointer hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="p-2 bg-blue-100 rounded-lg">
                                <Icon className="h-5 w-5 text-blue-600" />
                              </div>
                              <div className="flex-1">
                                <h3 className="font-medium text-sm">
                                  {serviceNames[service.service_type as keyof typeof serviceNames]}
                                </h3>
                                <Badge variant={service.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                                  {service.status === 'completed' ? 'مكتمل' : 'نشط'}
                                </Badge>
                              </div>
                            </div>
                            
                            {service.description && (
                              <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                                {service.description}
                              </p>
                            )}
                            
                            <div className="text-xs text-gray-500">
                              <div>تاريخ البدء: {new Date(service.assigned_date).toLocaleDateString('ar-SA')}</div>
                              {paymentInfo.totalAmount > 0 && (
                                <div className="mt-1">
                                  المدفوع: {paymentInfo.totalPaid} من {paymentInfo.totalAmount}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <div className="space-y-2">
                          <div className="font-medium">
                            {serviceNames[service.service_type as keyof typeof serviceNames]}
                          </div>
                          {service.description && (
                            <div className="text-sm">{service.description}</div>
                          )}
                          {paymentInfo.totalAmount > 0 && (
                            <div className="text-sm">
                              <div>إجمالي المبلغ: {paymentInfo.totalAmount}</div>
                              <div>المدفوع: {paymentInfo.totalPaid}</div>
                              <div>المتبقي: {paymentInfo.totalAmount - paymentInfo.totalPaid}</div>
                              <div>الحالة: {paymentInfo.status}</div>
                            </div>
                          )}
                          {service.notes && (
                            <div className="text-sm border-t pt-2">
                              <strong>ملاحظات:</strong> {service.notes}
                            </div>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
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
