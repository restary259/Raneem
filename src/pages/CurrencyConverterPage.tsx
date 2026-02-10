
import React from 'react';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import CurrencyConverter from '@/components/calculator/CurrencyConverter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DollarSign } from 'lucide-react';

const CurrencyConverterPage = () => {
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Header />
      <section className="py-12 md:py-20">
        <div className="container mx-auto px-4 max-w-4xl">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-2xl">
                <DollarSign className="h-6 w-6 text-primary" />
                محول العملات
              </CardTitle>
              <CardDescription>حوّل العملات واحسب التكاليف بعملتك المحلية</CardDescription>
            </CardHeader>
            <CardContent>
              <CurrencyConverter />
            </CardContent>
          </Card>
        </div>
      </section>
      <Footer />
    </div>
  );
};

export default CurrencyConverterPage;
