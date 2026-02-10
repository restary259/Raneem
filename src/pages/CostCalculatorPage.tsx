
import React from 'react';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import CostCalculator from '@/components/calculator/CostCalculator';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calculator } from 'lucide-react';
import { useDirection } from '@/hooks/useDirection';
import { useTranslation } from 'react-i18next';

const CostCalculatorPage = () => {
  const { dir } = useDirection();
  const { t } = useTranslation('resources');
  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <Header />
      <section className="py-12 md:py-20">
        <div className="container mx-auto px-4 max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-2xl">
                <Calculator className="h-6 w-6 text-primary" />
                {t('costCalculator.title')}
              </CardTitle>
              <CardDescription>{t('costCalculator.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <CostCalculator />
            </CardContent>
          </Card>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default CostCalculatorPage;
