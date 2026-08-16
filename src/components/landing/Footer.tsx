
import { InstagramIcon, FacebookIcon } from "@/components/landing/BrandIcons";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import TikTokIcon from "../icons/TikTokIcon";

// TikTokIcon component definition removed from here

const Footer = () => {
  const { t } = useTranslation();
  const { t: tLegal } = useTranslation('legal');
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
          <a href="https://www.instagram.com/darb_studyingermany/" target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors flex items-center gap-2">{t('footer.instagram')} <InstagramIcon size={24} /></a>
          <a href="https://www.tiktok.com/@darb_studyingrmany" target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors flex items-center gap-2">{t('footer.tiktok')} <TikTokIcon className="h-6 w-6" /></a>
          <a href="https://www.facebook.com/people/درب-للدراسة-في-المانيا/61557861907067/" target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors flex items-center gap-2">{t('footer.facebook', 'فيسبوك')} <FacebookIcon size={24} /></a>
        </div>
        <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-2 mb-6">
          <Link to="/faq" className="hover:text-accent transition-colors underline underline-offset-4">
            {t('footer.faq', 'الأسئلة الشائعة عن الدراسة في ألمانيا')}
          </Link>
          <Link to="/blog" className="hover:text-accent transition-colors underline underline-offset-4">
            {t('footer.blog', 'مدونة الدراسة في ألمانيا')}
          </Link>
          <Link to="/privacy" className="hover:text-accent transition-colors underline underline-offset-4">
            {tLegal('footer.privacy')}
          </Link>
          <Link to="/terms" className="hover:text-accent transition-colors underline underline-offset-4">
            {tLegal('footer.terms')}
          </Link>
          <Link to="/accessibility" className="hover:text-accent transition-colors underline underline-offset-4">
            {tLegal('footer.accessibility')}
          </Link>

        </div>
        <div className="text-center text-sm text-primary-foreground/70">
          {t('footer.copyright', { year })}
        </div>
      </div>
    </footer>
  );
};

export default Footer;
