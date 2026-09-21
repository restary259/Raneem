
import { Instagram, Facebook, Mail, MessageCircle } from "lucide-react";
import { Link } from "@/lib/router-compat";
import { useTranslation } from "react-i18next";
import TikTokIcon from "../icons/TikTokIcon";
import darbLogoAsset from '@/assets/darb-logo.png.asset.json';
import { SUPPORT_EMAIL, whatsappBusinessUrl } from '@/lib/contactConfig';

// TikTokIcon component definition removed from here

const Footer = () => {
  const { t } = useTranslation();
  const { t: tLegal } = useTranslation('legal');
  const year = new Date().getFullYear();
  return (
    <footer className="bg-primary text-primary-foreground pb-20 md:pb-0">
      <span aria-hidden="true" className="darb-spectrum darb-spectrum-sm rounded-none" />
      <div className="container mx-auto px-4 py-12 sm:py-14">
        <div className="grid gap-10 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
          <div className="max-w-md">
            <img src={darbLogoAsset.url} alt={t('loader.brand')} width={182} height={64} className="h-auto w-44 brightness-0 invert" loading="lazy" />
            <p className="mt-5 text-base leading-7 text-primary-foreground/75">{t('footer.quote')}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <a href={whatsappBusinessUrl("مرحبا، بدي أتواصل مع فريق درب بخصوص الدراسة بألمانيا.")} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-primary-foreground/25 px-4 text-sm font-semibold transition-colors hover:bg-primary-foreground hover:text-primary"><MessageCircle className="h-4 w-4" /> WhatsApp</a>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-primary-foreground/25 px-4 text-sm font-semibold transition-colors hover:bg-primary-foreground hover:text-primary"><Mail className="h-4 w-4" /> {SUPPORT_EMAIL}</a>
            </div>
          </div>
          <nav className="grid content-start gap-3 text-sm" aria-label={t('nav.resources')}>
            <p className="font-bold text-primary-foreground">{t('nav.resources')}</p>
            <Link to="/services" className="text-primary-foreground/70 transition-colors hover:text-primary-foreground">{t('nav.services')}</Link>
            <Link to="/ai-advisor" className="text-primary-foreground/70 transition-colors hover:text-primary-foreground">{t('nav.aiAdvisor')}</Link>
            <Link to="/educational-programs" className="text-primary-foreground/70 transition-colors hover:text-primary-foreground">{t('nav.majors')}</Link>
            <Link to="/faq" className="text-primary-foreground/70 transition-colors hover:text-primary-foreground">
            {t('footer.faq', 'الأسئلة الشائعة عن الدراسة في ألمانيا')}
          </Link>
            <Link to="/blog" className="text-primary-foreground/70 transition-colors hover:text-primary-foreground">
            {t('footer.blog', 'مدونة الدراسة في ألمانيا')}
          </Link>
          </nav>
          <nav className="grid content-start gap-3 text-sm" aria-label={t('nav.aboutDarb')}>
            <p className="font-bold text-primary-foreground">{t('nav.aboutDarb')}</p>
            <Link to="/contact" className="text-primary-foreground/70 transition-colors hover:text-primary-foreground">{t('nav.contact')}</Link>
            <Link to="/privacy" className="text-primary-foreground/70 transition-colors hover:text-primary-foreground">
            {tLegal('footer.privacy')}
          </Link>
            <Link to="/terms" className="text-primary-foreground/70 transition-colors hover:text-primary-foreground">
            {tLegal('footer.terms')}
          </Link>
            <Link to="/accessibility" className="text-primary-foreground/70 transition-colors hover:text-primary-foreground">
            {tLegal('footer.accessibility')}
          </Link>
          </nav>
        </div>
        <div className="mt-10 flex flex-col gap-5 border-t border-primary-foreground/15 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <a href="https://www.instagram.com/darb_studyingermany/" aria-label={t('footer.instagram')} target="_blank" rel="noopener noreferrer" className="grid h-11 w-11 place-items-center rounded-full border border-primary-foreground/20 transition-colors hover:bg-primary-foreground hover:text-primary"><Instagram size={20} /></a>
            <a href="https://www.tiktok.com/@darb_studyingrmany" aria-label={t('footer.tiktok')} target="_blank" rel="noopener noreferrer" className="grid h-11 w-11 place-items-center rounded-full border border-primary-foreground/20 transition-colors hover:bg-primary-foreground hover:text-primary"><TikTokIcon className="h-5 w-5" /></a>
            <a href="https://www.facebook.com/people/درب-للدراسة-في-المانيا/61557861907067/" aria-label={t('footer.facebook', 'فيسبوك')} target="_blank" rel="noopener noreferrer" className="grid h-11 w-11 place-items-center rounded-full border border-primary-foreground/20 transition-colors hover:bg-primary-foreground hover:text-primary"><Facebook size={20} /></a>
          </div>

          <div className="text-sm text-primary-foreground/60">{t('footer.copyright', { year })}</div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
