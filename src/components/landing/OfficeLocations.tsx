
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Phone, Clock, MessageCircle, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const OfficeLocations = () => {
  const { t } = useTranslation('common');

  return (
    <div className="space-y-8">
       <h3 className="text-3xl font-bold text-center">{t('officeLocations.title')}</h3>
        <Card className="bg-background/80 backdrop-blur-sm border border-white/20 shadow-lg animate-fade-in transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
          <CardHeader>
            <CardTitle className="text-primary">{t('officeLocations.city')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-muted-foreground">
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-accent" />
              <span>{t('officeLocations.address')}</span>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-accent" />
              <span>+972 52-940-2168</span>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-accent" />
              <a href="mailto:darbsocial27@gmail.com" className="hover:underline">darbsocial27@gmail.com</a>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-accent" />
              <span>{t('officeLocations.hours')}</span>
            </div>
             <Button asChild className="w-full mt-4" variant="outline">
                <a href="https://api.whatsapp.com/message/IVC4VCAEJ6TBD1" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                    <MessageCircle className="h-5 w-5" />
                    {t('officeLocations.whatsappButton')}
                </a>
             </Button>
          </CardContent>
        </Card>
    </div>
  );
};

export default OfficeLocations;
