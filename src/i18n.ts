
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';

i18n
  .use(HttpBackend)
  .use(initReactI18next)
  .init({
    lng: 'ar',
    fallbackLng: 'ar',
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
    ],
    defaultNS: 'common',
    debug: false,
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
  });

export default i18n;
