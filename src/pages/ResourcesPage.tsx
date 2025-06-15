import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import ResourceCard from '@/components/resources/ResourceCard';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import GpaCalculator from "@/components/calculator/GpaCalculator";
import { Calculator, Wallet, TrendingUp } from "lucide-react";
import CostCalculator from '@/components/calculator/CostCalculator';
import { useTranslation } from 'react-i18next';
import CurrencyComparator from '@/components/calculator/CurrencyComparator';

const ResourcesPage = () => {
  const { t } = useTranslation();
  const guides = t('resourcesPage.guides', { returnObjects: true });
  const resources: { title: string, description: string, fileUrl: string, fileSize?: string }[] = Array.isArray(guides) ? guides : [];

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <Header />
      <main className="flex-grow">
        <section className="bg-secondary/30 py-20">
            <div className="container mx-auto px-4 text-center">
                <h1 className="text-4xl md:text-5xl font-extrabold text-primary tracking-tight">
                    {t('resourcesPage.title')}
                </h1>
                <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                    {t('resourcesPage.subtitle')}
                </p>
            </div>
        </section>
        
        <section className="container mx-auto px-4 py-16">
            <div className="max-w-6xl mx-auto mb-16">
              <h2 className="text-3xl font-bold text-center mb-8">{t('resourcesPage.toolsTitle')}</h2>
              <Accordion type="single" collapsible className="w-full bg-card p-4 sm:p-6 rounded-lg shadow-md border" defaultValue="cost-calculator">
                <AccordionItem value="cost-calculator">
                  <AccordionTrigger className="text-xl font-bold hover:no-underline p-4">
                    <div className="flex items-center gap-3">
                      <Wallet className="h-6 w-6 text-primary" />
                      <span>{t('costCalculator.title')}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-0 pt-2 sm:p-4 sm:pt-2">
                    <CostCalculator />
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="currency-comparator">
                  <AccordionTrigger className="text-xl font-bold hover:no-underline p-4">
                    <div className="flex items-center gap-3">
                      <TrendingUp className="h-6 w-6 text-primary" />
                      <span>{t('currencyComparator.title')}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-0 pt-2 sm:p-4 sm:pt-2">
                    <CurrencyComparator />
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="gpa-calculator" className="border-b-0">
                  <AccordionTrigger className="text-xl font-bold hover:no-underline p-4">
                    <div className="flex items-center gap-3">
                      <Calculator className="h-6 w-6 text-primary" />
                      <span>{t('gpaCalculator.title')}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-4 pt-2">
                    <GpaCalculator />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            <h2 className="text-3xl font-bold text-center mb-8">{t('resourcesPage.guidesTitle')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {resources.map((resource, index) => (
                <ResourceCard 
                  key={index}
                  title={resource.title}
                  description={resource.description}
                  fileUrl={resource.fileUrl}
                  fileSize={resource.fileSize}
                />
              ))}
            </div>
        </section>
        
        <section className="container mx-auto px-4 pb-16">
            <div className="text-center p-8 bg-secondary/50 rounded-lg border border-primary/20">
              <h3 className="text-2xl font-bold text-primary mb-2">{t('resourcesPage.customGuide.title')}</h3>
              <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
                {t('resourcesPage.customGuide.subtitle')}
              </p>
              <Button asChild size="lg">
                <Link to="/contact">
                    {t('nav.contact')}
                </Link>
              </Button>
            </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default ResourcesPage;
