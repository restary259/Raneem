import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useParams } from 'react-router-dom';
import { CalendarDays, ExternalLink, Info } from 'lucide-react';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import SEOHead from '@/components/common/SEOHead';
import PageHero from '@/components/common/PageHero';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { blogArticles, getArticle, localeContent } from '@/content/blog';

const SITE = 'https://darb.agency';

/** Labels for the internal links a post points at. */
const RELATED_LABEL_KEYS: Record<string, string> = {
  '/services': 'related.services',
  '/faq': 'related.faq',
  '/contact': 'related.contact',
  '/educational-programs': 'related.programs',
  '/resources/cost-calculator': 'related.costCalculator',
  '/resources/bagrut-calculator': 'related.bagrutCalculator',
};

const BlogArticlePage: React.FC = () => {
  const { slug = '' } = useParams();
  const { t, i18n } = useTranslation('blog');
  const lang = i18n.language ?? 'ar';
  const article = getArticle(slug);

  const others = useMemo(
    () => blogArticles.filter((item) => item.slug !== slug).slice(0, 3),
    [slug],
  );

  const jsonLd = useMemo(() => {
    if (!article) return undefined;
    const content = localeContent(article, lang);
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: content.title,
        description: content.description,
        datePublished: article.publishedAt,
        dateModified: article.updatedAt,
        inLanguage: lang.startsWith('en') ? 'en' : 'ar',
        mainEntityOfPage: `${SITE}/blog/${article.slug}`,
        author: { '@type': 'Organization', name: 'Darb Agency' },
        publisher: { '@type': 'Organization', name: 'Darb Agency', url: SITE },
        citation: article.sources.map((source) => source.url),
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Darb', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: t('index.title'), item: `${SITE}/blog` },
          { '@type': 'ListItem', position: 3, name: content.title, item: `${SITE}/blog/${article.slug}` },
        ],
      },
    ];
  }, [article, lang, t]);

  if (!article) return <Navigate to="/blog" replace />;

  const content = localeContent(article, lang);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead
        title={`${content.title} | ${t('brand')}`}
        description={content.description}
        url={`/blog/${article.slug}`}
        jsonLd={jsonLd}
      />
      <Header />
      <main className="flex-1">
        <PageHero title={content.title} subtitle={content.excerpt} badge={t(`categories.${article.category}`)} />

        <article className="container mx-auto px-4 sm:px-6 py-10 md:py-14 max-w-3xl">
          <nav aria-label="breadcrumb" className="mb-6 text-sm text-muted-foreground flex flex-wrap gap-2">
            <Link to="/" className="hover:text-brand-strong">{t('breadcrumb.home')}</Link>
            <span aria-hidden="true">/</span>
            <Link to="/blog" className="hover:text-brand-strong">{t('index.title')}</Link>
          </nav>

          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-8">
            <CalendarDays className="h-3.5 w-3.5" />
            <span>{t('updatedOn')}</span>
            <time dateTime={article.updatedAt}>
              {new Date(article.updatedAt).toLocaleDateString('en-US')}
            </time>
          </div>

          {content.sections.map((section) => (
            <section key={section.heading} className="mb-10">
              <h2 className="text-2xl font-bold mb-4">{section.heading}</h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph} className="text-muted-foreground leading-relaxed mb-4">
                  {paragraph}
                </p>
              ))}
              {section.bullets && (
                <ul className="space-y-2 mb-4">
                  {section.bullets.map((bullet) => (
                    <li key={bullet} className="flex gap-3 text-muted-foreground leading-relaxed">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-brand-strong shrink-0" aria-hidden="true" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              )}
              {section.note && (
                <div className="flex gap-3 rounded-lg border border-brand/30 bg-brand-strong/5 p-4 text-sm">
                  <Info className="h-4 w-4 text-brand-strong shrink-0 mt-0.5" aria-hidden="true" />
                  <p>{section.note}</p>
                </div>
              )}
            </section>
          ))}

          <section className="mb-10">
            <h2 className="text-xl font-bold mb-3">{t('sources.title')}</h2>
            <p className="text-sm text-muted-foreground mb-4">{t('sources.note')}</p>
            <ul className="space-y-2">
              {article.sources.map((source) => (
                <li key={source.url}>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-brand-strong hover:underline"
                  >
                    {source.label}
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </section>

          <section className="mb-10">
            <h2 className="text-xl font-bold mb-4">{t('related.title')}</h2>
            <div className="flex flex-wrap gap-3">
              {article.relatedPaths.map((path) => (
                <Button key={path} asChild variant="outline" size="sm">
                  <Link to={path}>{t(RELATED_LABEL_KEYS[path] ?? 'related.more')}</Link>
                </Button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold mb-4">{t('moreArticles')}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {others.map((item) => {
                const other = localeContent(item, lang);
                return (
                  <Card key={item.slug}>
                    <CardContent className="p-5 space-y-2">
                      <Badge variant="secondary" className="w-fit">
                        {t(`categories.${item.category}`)}
                      </Badge>
                      <h3 className="font-semibold leading-snug">
                        <Link to={`/blog/${item.slug}`} className="hover:text-brand-strong transition-colors">
                          {other.title}
                        </Link>
                      </h3>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        </article>
      </main>
      <Footer />
    </div>
  );
};

export default BlogArticlePage;
