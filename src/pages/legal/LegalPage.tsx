import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import SEOHead from '@/components/common/SEOHead';
import PageHero from '@/components/common/PageHero';

export interface LegalSection {
  id: string;
  title: string;
  body?: string;
  items?: string[];
}

interface LegalPageProps {
  /** Translation key prefix inside the `legal` namespace: "privacy" | "terms" */
  docKey: 'privacy' | 'terms';
  /** Route of the sibling legal document. */
  relatedTo: string;
}

/** Shared renderer for the Privacy Policy and Terms of Use documents. */
const LegalPage: React.FC<LegalPageProps> = ({ docKey, relatedTo }) => {
  const { t } = useTranslation('legal');

  const sections = React.useMemo<LegalSection[]>(() => {
    const value = t(`${docKey}.sections`, { returnObjects: true });
    return Array.isArray(value) ? (value as LegalSection[]) : [];
  }, [t, docKey]);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title={t(`${docKey}.seo.title`)} description={t(`${docKey}.seo.description`)} />
      <Header />

      <main>
        <PageHero
          badge={t(`${docKey}.hero.badge`)}
          title={t(`${docKey}.hero.title`)}
          subtitle={t(`${docKey}.hero.subtitle`)}
        />

        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4 max-w-3xl">
            <p className="flex items-start gap-2 text-sm text-muted-foreground mb-6">
              <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
              <span>{t(`${docKey}.updated`)}</span>
            </p>

            <p className="text-base leading-relaxed text-muted-foreground mb-10">
              {t(`${docKey}.intro`)}
            </p>

            {sections.map((section, index) => (
              <article key={section.id} id={section.id} className="mb-8 scroll-mt-24">
                <h2 className="text-xl md:text-2xl font-bold mb-3">
                  {index + 1}. {section.title}
                </h2>

                {section.body && (
                  <p className="text-base leading-relaxed text-muted-foreground">{section.body}</p>
                )}

                {!!section.items?.length && (
                  <ul className="mt-3 space-y-2 list-disc ps-6 text-base leading-relaxed text-muted-foreground">
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </article>
            ))}

            <div className="mt-10 border-t pt-6">
              <Link to={relatedTo} className="text-primary hover:underline">
                {t(`related.${docKey}`)}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default LegalPage;
