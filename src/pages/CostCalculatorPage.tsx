
import React from 'react';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import CostCalculator from '@/components/calculator/CostCalculator';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calculator } from 'lucide-react';

const CostCalculatorPage = () => {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Header />
      <section className="py-12 md:py-20">
        <div className="container mx-auto px-4 max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-2xl">
                <Calculator className="h-6 w-6 text-primary" />
                حاسبة تكاليف المعيشة
              </CardTitle>
              <CardDescription>احسب تكاليف المعيشة والدراسة في ألمانيا</CardDescription>
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
