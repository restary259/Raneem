
import { useTranslation } from "react-i18next";

const AboutIntro = () => {
  const { t } = useTranslation();
  return (
    <section className="py-12 md:py-24 text-center bg-secondary">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl md:text-5xl font-bold text-primary">
          {t('aboutIntro.title')}
        </h1>
        <p className="mt-6 max-w-3xl mx-auto text-lg text-muted-foreground leading-relaxed">
          {t('aboutIntro.subtitle')}
        </p>
      </div>
    </section>
  );
};
export default AboutIntro;
