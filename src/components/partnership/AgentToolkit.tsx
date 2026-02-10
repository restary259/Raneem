
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Paperclip, Presentation, HelpCircle } from 'lucide-react';

const AgentToolkit = () => {
  const { t } = useTranslation('partnership');

  return (
    <section className="py-12 md:py-24 bg-primary/5">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold">{t('agentToolkit.title')}</h2>
          <p className="mt-4 text-lg text-muted-foreground">{t('agentToolkit.teaser')}</p>
          <div className="mt-8 flex justify-center gap-8 text-primary">
            <div className="flex flex-col items-center gap-2">
                <Paperclip className="h-8 w-8"/>
                <span className="font-semibold">{t('agentToolkit.labels.files')}</span>
            </div>
            <div className="flex flex-col items-center gap-2">
                <Presentation className="h-8 w-8"/>
                <span className="font-semibold">{t('agentToolkit.labels.marketing')}</span>
            </div>
            <div className="flex flex-col items-center gap-2">
                <HelpCircle className="h-8 w-8"/>
                <span className="font-semibold">{t('agentToolkit.labels.faq')}</span>
            </div>
          </div>
          <div className="mt-10">
            <Button size="lg" variant="outline">{t('agentToolkit.button')}</Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AgentToolkit;
