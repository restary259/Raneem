
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Quote, Star } from "lucide-react";

const SuccessStories = () => {
  const { t } = useTranslation('partnership');

  const stories = t('successStories.stories', { returnObjects: true }) as any[];

  return (
    <section className="py-12 md:py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <Badge variant="secondary" className="mb-4">{t('successStories.badge')}</Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-6">{t('successStories.title')}</h2>
          <p className="text-xl text-muted-foreground">{t('successStories.subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {Array.isArray(stories) && stories.map((story: any, index: number) => (
            <Card key={index} className="relative overflow-hidden">
              <CardContent className="p-6">
                <div className="absolute top-4 right-4"><Quote className="h-8 w-8 text-primary/20" /></div>
                <div className="mb-4">
                  <div className="flex items-center gap-1 mb-2">
                    {[...Array(5)].map((_, i) => (<Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />))}
                  </div>
                  <p className="text-gray-600 italic leading-relaxed">"{story.story}"</p>
                </div>
                <div className="border-t pt-4">
                  <h4 className="font-bold text-lg">{story.name}</h4>
                  <p className="text-primary font-medium mb-3">{story.role}</p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">{t('successStories.acceptedStudents')}</p>
                      <p className="font-bold text-lg text-primary">{story.students}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">{t('successStories.totalCommission')}</p>
                      <p className="font-bold text-lg text-green-600">{story.commission} {t('successStories.currency')}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
          <div className="p-6 bg-primary/5 rounded-lg"><div className="text-3xl font-bold text-primary mb-2">50+</div><div className="text-gray-600">{t('successStories.stats.activeAgents')}</div></div>
          <div className="p-6 bg-green-50 rounded-lg"><div className="text-3xl font-bold text-green-600 mb-2">200+</div><div className="text-gray-600">{t('successStories.stats.acceptedStudentsTotal')}</div></div>
          <div className="p-6 bg-blue-50 rounded-lg"><div className="text-3xl font-bold text-blue-600 mb-2">500K+</div><div className="text-gray-600">{t('successStories.stats.commissionsPaid')}</div></div>
          <div className="p-6 bg-orange-50 rounded-lg"><div className="text-3xl font-bold text-orange-600 mb-2">95%</div><div className="text-gray-600">{t('successStories.stats.satisfactionRate')}</div></div>
        </div>
      </div>
    </section>
  );
};

export default SuccessStories;
