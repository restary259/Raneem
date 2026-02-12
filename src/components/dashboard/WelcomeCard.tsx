import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';

interface WelcomeCardProps {
  fullName: string;
  userId: string;
}

const WelcomeCard: React.FC<WelcomeCardProps> = ({ fullName }) => {
  const { t } = useTranslation('dashboard');

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 mb-6">
      <CardContent className="p-6">
        <h2 className="text-xl font-bold">{t('welcome.greeting', { name: fullName })}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t('welcome.subtitle')}</p>
      </CardContent>
    </Card>
  );
};

export default WelcomeCard;
