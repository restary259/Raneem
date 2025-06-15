
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GermanyTab from './GermanyTab';
import RomaniaTab from './RomaniaTab';
import JordanTab from './JordanTab';
import { Button } from '@/components/ui/button';
import { Link as RouterLink } from 'react-router-dom';

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
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="germany">🇩🇪 {t('universityFinder.germany')}</TabsTrigger>
              <TabsTrigger value="romania">🇷🇴 {t('universityFinder.romania')}</TabsTrigger>
              <TabsTrigger value="jordan">🇯🇴 {t('universityFinder.jordan')}</TabsTrigger>
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
