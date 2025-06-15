
import { useTranslation } from "react-i18next";

const InfluencerMessage = () => {
  const { t } = useTranslation('partnership');
  return (
    <section className="py-12 md:py-24 bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 text-center">
        <h2 className="text-3xl md:text-4xl font-bold">{t('influencerMessage.title')}</h2>
        <p className="mt-6 max-w-3xl mx-auto text-lg md:text-xl text-primary-foreground/80">
          {t('influencerMessage.body')}
        </p>
      </div>
    </section>
  );
};

export default InfluencerMessage;
