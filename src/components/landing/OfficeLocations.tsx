
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Phone, Clock, MessageCircle, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SUPPORT_EMAIL, SUPPORT_PHONE, whatsappBusinessUrl } from '@/lib/contactConfig';

const OfficeLocations = () => {
  const { t } = useTranslation('common');

  return (
    <div className="space-y-5">
       <h3 className="text-2xl font-bold text-primary">{t('officeLocations.title')}</h3>
        <Card className="rounded-none border-border bg-background shadow-none">
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
               <a href={`tel:${SUPPORT_PHONE}`} dir="ltr" className="hover:underline">{SUPPORT_PHONE}</a>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-accent" />
               <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:underline">{SUPPORT_EMAIL}</a>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-accent" />
              <span>{t('officeLocations.hours')}</span>
            </div>
              <Button asChild className="w-full mt-4 rounded-none" variant="outline">
                <a href={whatsappBusinessUrl("مرحبا، بدي أتواصل مع مكتب درب.")} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
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
