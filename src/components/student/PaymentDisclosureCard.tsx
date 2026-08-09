import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Shown to the student once their case reaches the payment stage.
 * Money is handled in person at the office, so this is a service disclosure —
 * not a distance-sale checkout notice.
 */
const PaymentDisclosureCard: React.FC = () => {
  const { t } = useTranslation('dashboard');
  const lines = ['l1', 'l2', 'l3', 'l4'];

  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Info className="h-5 w-5 text-amber-600" aria-hidden="true" />
          {t('student.payDisclosure.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-2">
          {lines.map((key) => (
            <li key={key} className="text-sm leading-relaxed text-muted-foreground">
              {t(`student.payDisclosure.${key}`)}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-4 text-sm">
          <Link to="/services#service-disclosure" className="underline underline-offset-4">
            {t('student.payDisclosure.link')}
          </Link>
          <Link to="/terms" className="underline underline-offset-4">
            {t('student.payDisclosure.terms')}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};

export default PaymentDisclosureCard;
