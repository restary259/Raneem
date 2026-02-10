
import React from 'react';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import GpaCalculator from '@/components/calculator/GpaCalculator';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { GraduationCap } from 'lucide-react';

const BagrutCalculatorPage = () => {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Header />
      <section className="py-12 md:py-20">
        <div className="container mx-auto px-4 max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-2xl">
                <GraduationCap className="h-6 w-6 text-primary" />
                حاسبة البجروت
              </CardTitle>
              <CardDescription>احسب معدلك في البجروت وما يعادله في النظام الألماني (الطريقة البافارية)</CardDescription>
            </CardHeader>
            <CardContent>
              <GpaCalculator />
            </CardContent>
          </Card>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default BagrutCalculatorPage;
