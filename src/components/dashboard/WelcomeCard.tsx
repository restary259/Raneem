import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

interface WelcomeCardProps {
  fullName: string;
  userId: string;
}

const WelcomeCard: React.FC<WelcomeCardProps> = ({ fullName }) => {
  return (
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 mb-6">
      <CardContent className="p-6">
        <h2 className="text-xl font-bold">مرحباً، {fullName}! 👋</h2>
        <p className="text-sm text-muted-foreground mt-1">تابع تقدمك وأكمل المتطلبات لرحلتك الدراسية.</p>
      </CardContent>
    </Card>
  );
};

export default WelcomeCard;
