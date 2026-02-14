import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import GuidesReferences from '@/components/resources/GuidesReferences';
import SEOHead from '@/components/common/SEOHead';
import PageHero from '@/components/common/PageHero';
import { Calculator, DollarSign, GraduationCap, FileText, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useInView } from 'react-intersection-observer';

const ToolsSection = ({ tools }: { tools: { id: string; title: string; description: string; icon: React.ElementType; path: string }[] }) => {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });
  const { t } = useTranslation('resources');

  return (
    <section className="py-12 md:py-20 bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-10">{t('tabs.tools')}</h2>
        <div ref={ref} className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {tools.map((tool, index) => (
            <Card
              key={tool.id}
              className={`shadow-md hover:shadow-2xl border-t-2 border-t-accent/20 hover:-translate-y-1 hover:border-accent/20 group ${inView ? 'opacity-0 animate-fade-in-up' : 'opacity-0'}`}
              style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'forwards' }}
            >
              <CardHeader className="text-center">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-300">
                  <tool.icon className="h-7 w-7 text-primary" />
                </div>
                <CardTitle className="text-xl">{tool.title}</CardTitle>
                <CardDescription>{tool.description}</CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Button asChild>
                  <Link to={tool.path} className="flex items-center gap-2">
                    {t('educational.openTool', { ns: 'common' })}
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

const GuidesSection = () => {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  return (
    <section className="py-12 md:py-20 bg-gradient-to-b from-muted/40 to-muted/20">
      <div className="container mx-auto px-4">
        <div ref={ref} className={inView ? 'animate-fade-in' : 'opacity-0'}>
          <GuidesReferences />
        </div>
      </div>
    </section>
  );
};

const ResourcesPage = () => {
  const { t } = useTranslation(['resources', 'common']);

  const tools = [
    { id: 'cost-calculator', title: t('costCalculator.title'), description: t('costCalculator.description'), icon: Calculator, path: '/resources/cost-calculator' },
    { id: 'currency-converter', title: t('currencyComparator.title'), description: t('currencyComparator.description'), icon: DollarSign, path: '/resources/currency-converter' },
    { id: 'bagrut-calculator', title: t('gpaCalculator.title'), description: t('gpaCalculator.description'), icon: GraduationCap, path: '/resources/bagrut-calculator' },
    { id: 'lebenslauf-builder', title: t('lebenslaufBuilder.title'), description: t('lebenslaufBuilder.description'), icon: FileText, path: '/resources/lebenslauf-builder' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-primary/[0.02] to-background">
      <SEOHead title={t('seo.resourcesTitle', { ns: 'common' })} description={t('seo.resourcesDesc', { ns: 'common' })} />
      <Header />
      
      {/* Hero Section */}
      <PageHero
        variant="light"
        title={t('resourcesPage.title')}
        subtitle={t('resourcesPage.subtitle')}
      />

      <ToolsSection tools={tools} />
      <GuidesSection />

      {/* FAQ Section */}
      <section className="py-12 md:py-20 bg-gradient-to-b from-background to-primary/[0.03]">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">{t('faq.title')}</h2>
            <div className="grid gap-6">
              <Card className="shadow-md hover:shadow-lg border-l-4 border-l-accent/60 transition-shadow duration-300">
                <CardHeader>
                  <CardTitle className="text-lg">{t('faq.questions.costCalculator.question')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{t('faq.questions.costCalculator.answer')}</p>
                </CardContent>
              </Card>
              <Card className="shadow-md hover:shadow-lg border-l-4 border-l-accent/60 transition-shadow duration-300">
                <CardHeader>
                  <CardTitle className="text-lg">{t('faq.questions.exchangeRates.question')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{t('faq.questions.exchangeRates.answer')}</p>
                </CardContent>
              </Card>
              <Card className="shadow-md hover:shadow-lg border-l-4 border-l-accent/60 transition-shadow duration-300">
                <CardHeader>
                  <CardTitle className="text-lg">{t('faq.questions.accuracy.question')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{t('faq.questions.accuracy.answer')}</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default ResourcesPage;
