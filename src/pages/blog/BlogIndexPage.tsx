import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CalendarDays } from 'lucide-react';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import SEOHead from '@/components/common/SEOHead';
import PageHero from '@/components/common/PageHero';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { blogArticles, localeContent } from '@/content/blog';

const BlogIndexPage: React.FC = () => {
  const { t, i18n } = useTranslation('blog');
  const lang = i18n.language ?? 'ar';
  const isRtl = !lang.startsWith('en');
  const Arrow = isRtl ? ArrowLeft : ArrowRight;

  const items = useMemo(
    () => blogArticles.map((article) => ({ article, content: localeContent(article, lang) })),
    [lang],
  );

  const jsonLd = useMemo(
    () => ({
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: t('index.title'),
      url: 'https://darb.agency/blog',
      blogPost: items.map(({ article, content }) => ({
        '@type': 'BlogPosting',
        headline: content.title,
        description: content.description,
        datePublished: article.publishedAt,
        dateModified: article.updatedAt,
        url: `https://darb.agency/blog/${article.slug}`,
      })),
    }),
    [items, t],
  );

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead
        title={t('index.metaTitle')}
        description={t('index.metaDescription')}
        url="/blog"
        jsonLd={jsonLd}
      />
      <Header />
      <main className="flex-1">
        <PageHero title={t('index.title')} subtitle={t('index.subtitle')} badge={t('index.badge')} />

        <section className="container mx-auto px-4 sm:px-6 py-12 md:py-16">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
            {items.map(({ article, content }) => (
              <Card key={article.slug} className="h-full transition-shadow hover:shadow-lg">
                <CardContent className="p-6 flex flex-col h-full gap-4">
                  <Badge variant="secondary" className="w-fit">
                    {t(`categories.${article.category}`)}
                  </Badge>
                  <h2 className="text-xl font-bold leading-snug">
                    <Link to={`/blog/${article.slug}`} className="hover:text-brand transition-colors">
                      {content.title}
                    </Link>
                  </h2>
                  <p className="text-muted-foreground text-sm leading-relaxed flex-1">{content.excerpt}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" />
                    <time dateTime={article.updatedAt}>
                      {new Date(article.updatedAt).toLocaleDateString('en-US')}
                    </time>
                  </div>
                  <Link
                    to={`/blog/${article.slug}`}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-brand"
                  >
                    {t('index.readMore')}
                    <Arrow className="h-4 w-4" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default BlogIndexPage;
