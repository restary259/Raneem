import React from 'react';
import { useTranslation } from 'react-i18next';
import GpaCalculator from '@/components/calculator/GpaCalculator';

export default function BagrutConverter() {
  const { t } = useTranslation('dashboard');
  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">{t('nav.bagrut', 'Bagrut Tool')}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t('team.bagrut.subtitle', 'Convert Bagrut scores to German university grades')}
        </p>
      </div>
      <GpaCalculator />
    </div>
  );
}
