
import { Instagram, Facebook } from "lucide-react";
import { useTranslation } from "react-i18next";

const TikTokIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6" {...props}>
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-2.43.03-4.83-.95-6.43-2.88-1.59-1.92-2.3-4.45-1.96-6.84.34-2.38 1.95-4.48 3.98-5.61.99-.54 2.11-.83 3.25-.83.01 2.11-.01 4.22.01 6.33-.02 1.21-.57 2.36-1.55 3.14-1.63 1.29-4.04 1.05-5.38-.61-.92-1.15-1.16-2.67-.81-4.06.35-1.39 1.32-2.58 2.5-3.33.91-.56 2-.85 3.11-.85.02 1.48.01 2.96.01 4.44z"></path>
    </svg>
);


const Footer = () => {
  const { t } = useTranslation();
  const year = new Date().getFullYear();
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <p className="text-lg italic">
            "{t('footer.quote')}"
          </p>
        </div>
        <div className="flex justify-center items-center space-x-6 space-x-reverse mb-8">
          <a href="https://instagram.com/darb_studyinternational" target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors flex items-center gap-2">{t('footer.instagram')} <Instagram /></a>
          <a href="https://tiktok.com/@darb_studyinternational" target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors flex items-center gap-2">{t('footer.tiktok')} <TikTokIcon /></a>
          <a href="https://www.facebook.com/DARB_STUDYINGERMANY" target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors flex items-center gap-2">{t('footer.facebook', 'فيسبوك')} <Facebook /></a>
        </div>
        <div className="text-center text-sm text-primary-foreground/70">
          {t('footer.copyright', { year })}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
