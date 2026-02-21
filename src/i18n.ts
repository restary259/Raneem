
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';

// Import broadcast translations directly to avoid async loading issues
import broadcastAr from '../public/locales/ar/broadcast.json';
import broadcastEn from '../public/locales/en/broadcast.json';

const savedLang = typeof window !== 'undefined' ? localStorage.getItem('i18n_lang') : null;

i18n
  .use(HttpBackend)
  .use(initReactI18next)
  .init({
    lng: savedLang || 'ar',
    fallbackLng: 'ar',
    supportedLngs: ['ar', 'en'],
    ns: [
      'common',
      'landing',
      'about',
      'services',
      'partnership',
      'contact',
      'partners',
      'resources',
      'broadcast',
      'dashboard',
    ],
    defaultNS: 'common',
    partialBundledLanguages: true,
    resources: {
      ar: { broadcast: broadcastAr },
      en: { broadcast: broadcastEn },
    },
    debug: false,
    interpolation: {
      escapeValue: false,
    },
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    react: {
      useSuspense: true,
    },
  });

// Update document direction on language change
i18n.on('languageChanged', (lng) => {
  const dir = lng === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.dir = dir;
  document.documentElement.lang = lng;
  localStorage.setItem('i18n_lang', lng);
});

export default i18n;
