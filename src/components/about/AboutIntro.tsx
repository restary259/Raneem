
import { useTranslation } from "react-i18next";
import PageHero from "@/components/common/PageHero";

const AboutIntro = () => {
  const { t } = useTranslation();
  return (
    <PageHero
      variant="light"
      title={t('aboutIntro.title')}
      subtitle={t('aboutIntro.subtitle')}
    />
  );
};
export default AboutIntro;
