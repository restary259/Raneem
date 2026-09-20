import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@/lib/router-compat';
import { ExternalLink, HelpCircle, ShieldCheck } from 'lucide-react';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import SEOHead from '@/components/common/SEOHead';
import DarbPageHero from '@/components/common/DarbPageHero';
import { DARB_PUBLIC_HERO_IMAGES } from '@/config/publicHeroImages';
import { Button } from '@/components/ui/button';
import { DARB_CONTACT_ADVISOR_SRC } from '@/assets/darbContactAdvisor';
import { Card, CardContent } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface FaqSource {
  label: string;
  url: string;
}

interface FaqItem {
  q: string;
  a: string;
  sources?: FaqSource[];
}

interface FaqCategory {
  id: string;
  title: string;
  items: FaqItem[];
}

const JSON_LD_ID = 'faq-jsonld';

const FaqPage: React.FC = () => {
  const { t } = useTranslation('faq');

  const categories = useMemo<FaqCategory[]>(() => {
    const value = t('categories', { returnObjects: true });
    return Array.isArray(value) ? (value as FaqCategory[]) : [];
  }, [t]);

  // FAQPage structured data so the answers can surface in search & AI results.
  useEffect(() => {
    if (!categories.length) return;

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = JSON_LD_ID;
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: categories.flatMap((category) =>
        category.items.map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      ),
    });
    document.head.appendChild(script);

    return () => {
      document.getElementById(JSON_LD_ID)?.remove();
    };
  }, [categories]);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title={t('seo.title')} description={t('seo.description')} />
      <Header />

      <main>
        <DarbPageHero
          eyebrow={t('hero.badge')}
          imageUrl={DARB_PUBLIC_HERO_IMAGES.studyPath}
          imageAlt={t('hero.imageAlt', 'A bright study environment in Germany')}
          title={t('hero.title')}
          subtitle={t('hero.subtitle')}
        />

        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4 max-w-3xl">
            <p className="flex items-start gap-2 text-sm text-muted-foreground mb-8">
              <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
              <span>{t('meta.updated')}</span>
            </p>

            {categories.map((category) => (
              <div key={category.id} className="mb-10">
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-primary" />
                  {category.title}
                </h2>

                <Accordion type="single" collapsible className="w-full">
                  {category.items.map((item, index) => (
                    <AccordionItem key={`${category.id}-${index}`} value={`${category.id}-${index}`}>
                      <AccordionTrigger className="text-start text-base font-semibold">
                        {item.q}
                      </AccordionTrigger>
                      <AccordionContent className="text-base leading-relaxed text-muted-foreground">
                        <p>{item.a}</p>

                        {!!item.sources?.length && (
                          <ul className="mt-4 space-y-2">
                            {item.sources.map((source) => (
                              <li key={source.url}>
                                <a
                                  href={source.url}
                                  target="_blank"
                                  rel="noopener noreferrer nofollow"
                                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                                >
                                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                                  <span>
                                    {t('meta.sourcesLabel')}: {source.label}
                                  </span>
                                </a>
                              </li>
                            ))}
                          </ul>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ))}

            <Card className="bg-muted/40 border-dashed">
              <CardContent className="pt-6 text-sm text-muted-foreground">
                {t('meta.disclaimer')}
              </CardContent>
            </Card>

            <div className="mt-14 border border-border bg-muted/20 px-6 py-8 text-center md:px-10 md:py-10">
              <div className="mx-auto mb-5 h-24 w-24 overflow-hidden rounded-full border-4 border-background shadow-[0_12px_32px_rgba(17,17,17,0.12)] ring-1 ring-border">
                <img src={DARB_CONTACT_ADVISOR_SRC} alt={t('meta.ctaTitle')} className="h-full w-full object-cover" loading="lazy" />
              </div>
              <h2 className="text-2xl font-bold mb-2">{t('meta.ctaTitle')}</h2>
              <p className="mx-auto mb-6 max-w-2xl text-muted-foreground">{t('meta.ctaText')}</p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button asChild size="lg">
                  <Link to="/apply">{t('meta.ctaButton')}</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/contact">{t('meta.ctaSecondary')}</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default FaqPage;
