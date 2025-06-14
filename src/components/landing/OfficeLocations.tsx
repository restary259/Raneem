import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Phone, Clock, MessageCircle, Mail } from 'lucide-react';

const office = {
  city: 'طمرة, إسرائيل',
  address: 'شارع رئيسي، طمرة',
  phone: '+972 52-940-2168',
  email: 'darbsocial27@gmail.com',
  hours: 'الأحد - الخميس: 9 صباحًا - 5 مساءً',
  whatsapp: '972524061225',
};

const OfficeLocations = () => {
  return (
    <div className="space-y-8 text-right">
       <h3 className="text-3xl font-bold text-center md:text-right">مكتبنا الرئيسي</h3>
        <Card className="bg-background/80 backdrop-blur-sm border border-white/20 shadow-lg animate-fade-in transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
          <CardHeader>
            <CardTitle className="text-primary">{office.city}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground">
            <div className="flex items-center justify-end gap-3">
              <span>{office.address}</span>
              <MapPin className="h-5 w-5 text-accent" />
            </div>
            <div className="flex items-center justify-end gap-3">
              <span>{office.phone}</span>
              <Phone className="h-5 w-5 text-accent" />
            </div>
            <div className="flex items-center justify-end gap-3">
               <a href={`mailto:${office.email}`} className="hover:underline">{office.email}</a>
              <Mail className="h-5 w-5 text-accent" />
            </div>
            <div className="flex items-center justify-end gap-3">
              <span>{office.hours}</span>
              <Clock className="h-5 w-5 text-accent" />
            </div>
             <Button asChild className="w-full mt-4" variant="outline">
                <a href={`https://wa.me/${office.whatsapp}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                    <MessageCircle className="h-5 w-5" />
                    ابدأ محادثة واتساب
                </a>
             </Button>
          </CardContent>
        </Card>
    </div>
  );
};

export default OfficeLocations;
