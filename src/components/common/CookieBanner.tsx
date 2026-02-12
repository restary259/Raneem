
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDirection } from '@/hooks/useDirection';
import { Cookie, X } from 'lucide-react';

const COOKIE_KEY = 'darb_cookie_consent';

const getCookie = (name: string): string => {
  return document.cookie.split('; ').reduce((r, v) => {
    const [k, ...rest] = v.split('=');
    return k === name ? decodeURIComponent(rest.join('=')) : r;
  }, '');
};

const setCookie = (name: string, value: string, days: number) => {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
};

const CookieBanner = () => {
  const [consent, setConsent] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const { dir } = useDirection();
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  useEffect(() => {
    const c = getCookie(COOKIE_KEY);
    setConsent(c || null);
    setLoaded(true);
  }, []);

  const acceptAll = () => {
    setCookie(COOKIE_KEY, 'all', 365);
    setConsent('all');
  };

  const acceptNecessary = () => {
    setCookie(COOKIE_KEY, 'necessary', 365);
    setConsent('necessary');
  };

  if (!loaded || consent) return null;

  return (
    <div
      className="fixed bottom-20 md:bottom-6 inset-x-4 md:inset-x-8 z-[60] rounded-xl p-4 shadow-xl bg-card border border-border text-card-foreground text-sm animate-in slide-in-from-bottom-4"
      dir={dir}
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Cookie className="w-5 h-5 text-accent shrink-0 mt-0.5" />
          <div>
            <strong className="block mb-0.5">
              {isAr ? 'نستخدم ملفات تعريف الارتباط' : 'We use cookies'}
            </strong>
            <span className="text-xs text-muted-foreground">
              {isAr
                ? 'نستخدم ملفات تعريف الارتباط الضرورية لتشغيل الموقع. بموافقتك، نستخدم أيضاً ملفات التحليلات لتحسين الموقع.'
                : 'We use necessary cookies to run the site. With your consent we also use analytics to improve it.'}
            </span>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={acceptNecessary}
            className="px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors"
          >
            {isAr ? 'الضرورية فقط' : 'Only necessary'}
          </button>
          <button
            onClick={acceptAll}
            className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            {isAr ? 'قبول الكل' : 'Accept all'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CookieBanner;
