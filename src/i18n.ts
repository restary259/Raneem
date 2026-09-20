
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
    fallbackLng: { he: ['en'], default: ['ar'] },
    supportedLngs: ['ar', 'en', 'he'],
    // Only the namespace every route needs is loaded up front. The rest are
    // fetched on demand by useTranslation(<ns>) through the HTTP backend, so a
    // public page no longer waits on dashboard.json (59 kB) before first paint.
    ns: ['common'],

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
      // Cloudflare Workers have no window, so i18next-http-backend otherwise
      // assumes a Node/server runtime and creates a global setInterval().
      reloadInterval: false,
    },
    react: {
      useSuspense: true,
    },
  });

// Update document direction on language change
i18n.on('languageChanged', (lng) => {
  // SSR guard — this module is evaluated on the server too (TanStack Start).
  if (typeof document === 'undefined') return;
  const dir = (lng === 'ar' || lng === 'he') ? 'rtl' : 'ltr';
  document.documentElement.dir = dir;
  document.documentElement.lang = lng;
  localStorage.setItem('i18n_lang', lng);
});

export default i18n;
