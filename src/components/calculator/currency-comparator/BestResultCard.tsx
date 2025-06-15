
import { Trans, useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import { Result, FormValues, countries } from './data';
import { UseFormReturn } from 'react-hook-form';

interface BestResultCardProps {
  bestResult: Result;
  form: UseFormReturn<FormValues>;
  targetCountry: keyof typeof countries;
}

export const BestResultCard = ({ bestResult, form, targetCountry }: BestResultCardProps) => {
  const { t } = useTranslation('resources');
  const targetCurrency = countries[targetCountry].currency;

  return (
    <Card className="bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-green-800 dark:text-green-300">
          <TrendingUp />
          {t('currencyComparator.bestRecommendation')}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm sm:text-base text-green-900 dark:text-green-200">
        <Trans
          i18nKey="currencyComparator.bestRecommendationText"
          values={{
            amount: form.getValues('amount').toLocaleString(),
            country: t(`currencyComparator.${countries[targetCountry].nameKey}`),
            service: bestResult.service,
            bank: bestResult.bank,
            received: Math.round(bestResult.received).toLocaleString(),
            currency: targetCurrency,
            time: bestResult.time,
            fee: bestResult.totalFee.toLocaleString()
          }}
          components={{
            1: <span className="font-bold" />,
            2: <span className="font-bold" />,
            3: <span className="font-bold text-lg" />,
          }}
        />
      </CardContent>
    </Card>
  );
};
