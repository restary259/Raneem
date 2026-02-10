
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

interface Article {
  id: string;
  title: string;
  description: string;
  category: string;
  content: string;
}

const GuidesReferences = () => {
  const { t } = useTranslation('resources');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const articles = t('guides.articles', { returnObjects: true }) as Article[];

  const toggle = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  if (!Array.isArray(articles)) return null;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <h2 className="text-3xl font-bold text-primary">{t('guides.sectionTitle')}</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          {t('guides.sectionSubtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {articles.map((article) => (
          <Card key={article.id} className="hover:shadow-lg transition-all duration-200 flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="h-5 w-5 text-primary" />
                <Badge variant="outline" className="text-xs">
                  {article.category}
                </Badge>
              </div>
              <CardTitle className="text-lg leading-tight">{article.title}</CardTitle>
            </CardHeader>

            <CardContent className="space-y-3 flex-1 flex flex-col">
              <p className="text-sm text-muted-foreground">{article.description}</p>

              {expandedId === article.id && (
                <div className="text-sm text-foreground whitespace-pre-line leading-relaxed border-t pt-3 mt-2">
                  {article.content}
                </div>
              )}

              <div className="mt-auto pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggle(article.id)}
                  className="w-full text-primary hover:text-primary/80"
                >
                  {expandedId === article.id ? (
                    <><ChevronUp className="h-4 w-4 mr-1" />{t('guides.collapse')}</>
                  ) : (
                    <><ChevronDown className="h-4 w-4 mr-1" />{t('guides.readMore')}</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default GuidesReferences;
