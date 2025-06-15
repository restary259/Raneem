import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GermanyTab from './GermanyTab';
import RomaniaTab from './RomaniaTab';
import JordanTab from './JordanTab';
import { Button } from '@/components/ui/button';
import { Link as RouterLink } from 'react-router-dom';
import GpaCalculator from '../calculator/GpaCalculator';
import CurrencyComparator from '../calculator/CurrencyComparator';
import CostCalculator from '../calculator/CostCalculator';
import { Calculator, Euro, GraduationCap } from 'lucide-react';

const UniversityFinder = () => {
  const { t } = useTranslation();

  return (
    <>
      <section className="bg-secondary/30 py-20">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold text-primary tracking-tight">
            {t('universityFinder.title')}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-3xl mx-auto">
            {t('universityFinder.subtitle')}
          </p>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <Tabs defaultValue="germany" className="w-full">
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 md:grid-cols-6 h-auto">
              <TabsTrigger value="germany" className="w-full text-base py-3">🇩🇪 {t('universityFinder.germany')}</TabsTrigger>
              <TabsTrigger value="romania" className="w-full text-base py-3">🇷🇴 {t('universityFinder.romania')}</TabsTrigger>
              <TabsTrigger value="jordan" className="w-full text-base py-3">🇯🇴 {t('universityFinder.jordan')}</TabsTrigger>
              <TabsTrigger value="gpa" className="w-full text-base py-3"><GraduationCap className="ltr:mr-2 rtl:ml-2 h-5 w-5" />{t('universityFinder.gpaCalculator')}</TabsTrigger>
              <TabsTrigger value="currency" className="w-full text-base py-3"><Euro className="ltr:mr-2 rtl:ml-2 h-5 w-5" />{t('universityFinder.currencyComparator')}</TabsTrigger>
              <TabsTrigger value="cost" className="w-full text-base py-3"><Calculator className="ltr:mr-2 rtl:ml-2 h-5 w-5" />{t('universityFinder.costCalculator')}</TabsTrigger>
            </TabsList>
            <TabsContent value="germany" className="mt-6">
              <GermanyTab />
            </TabsContent>
            <TabsContent value="romania" className="mt-6">
              <RomaniaTab />
            </TabsContent>
            <TabsContent value="jordan" className="mt-6">
              <JordanTab />
            </TabsContent>
            <TabsContent value="gpa" className="mt-6">
              <GpaCalculator />
            </TabsContent>
            <TabsContent value="currency" className="mt-6">
              <CurrencyComparator />
            </TabsContent>
            <TabsContent value="cost" className="mt-6">
              <CostCalculator />
            </TabsContent>
          </Tabs>
        </div>
      </section>
      
      <section className="container mx-auto px-4 pb-16">
        <div className="text-center p-8 bg-secondary/50 rounded-lg border border-primary/20 max-w-6xl mx-auto">
          <h3 className="text-2xl font-bold text-primary mb-2">{t('universityFinder.ctaTitle')}</h3>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            {t('universityFinder.ctaSubtitle')}
          </p>
          <Button asChild size="lg">
            <RouterLink to="/contact">
                {t('universityFinder.ctaButton')}
            </RouterLink>
          </Button>
        </div>
      </section>
    </>
  );
};

export default UniversityFinder;
