
import { Instagram, Facebook } from "lucide-react";
import { useTranslation } from "react-i18next";
import TikTokIcon from "../icons/TikTokIcon";

// TikTokIcon component definition removed from here

const Footer = () => {
  const { t } = useTranslation();
  const year = new Date().getFullYear();
  return (
    <footer className="bg-primary text-primary-foreground pb-20 md:pb-0">
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <p className="text-lg italic">
            "{t('footer.quote')}"
          </p>
        </div>
        <div className="flex justify-center items-center gap-4 sm:gap-6 mb-8 flex-wrap">
          <a href="https://instagram.com/darb_studyinternational" target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors flex items-center gap-2">{t('footer.instagram')} <Instagram size={24} /></a>
          <a href="https://tiktok.com/@darb_studyinternational" target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors flex items-center gap-2">{t('footer.tiktok')} <TikTokIcon className="h-6 w-6" /></a>
          <a href="https://www.facebook.com/DARB_STUDYINGERMANY" target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors flex items-center gap-2">{t('footer.facebook', 'فيسبوك')} <Facebook size={24} /></a>
        </div>
        <div className="text-center text-sm text-primary-foreground/70">
          {t('footer.copyright', { year })}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
