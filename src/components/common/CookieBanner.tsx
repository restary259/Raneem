
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDirection } from '@/hooks/useDirection';
import { Cookie } from 'lucide-react';
import { COOKIE_CONSENT_KEY, initAnalytics, trackPageView } from '@/lib/analytics';
import { Button } from '@/components/ui/button';

const CookieBanner = () => {
  const [visible, setVisible] = useState(false);
  const { dir } = useDirection();
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  useEffect(() => {
    // Use localStorage for persistence (survives session, not affected by login/logout)
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!stored) {
      setVisible(true);
    }
  }, []);

  const accept = (level: string) => {
    localStorage.setItem(COOKIE_CONSENT_KEY, level);
    setVisible(false);
    // Consent-gated analytics: "Accept all" starts GA4 for the current page.
    // The route-tracking hook covers every later navigation.
    if (level === 'all') {
      initAnalytics();
      trackPageView(window.location.pathname);
    }
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-20 inset-x-3 z-[55] rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-surface-lg animate-in slide-in-from-bottom-4 md:bottom-6 md:inset-x-8 md:rounded-full md:px-5"
      dir={dir}
      role="dialog"
      aria-label="Cookie consent"
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
        <div className="grid grid-cols-2 gap-2 shrink-0 md:flex">
          <Button
            onClick={() => accept('necessary')}
            variant="secondary"
            size="sm"
            className="text-xs"
          >
            {isAr ? 'الضرورية فقط' : 'Only necessary'}
          </Button>
          <Button
            onClick={() => accept('all')}
            size="sm"
            className="text-xs"
          >
            {isAr ? 'قبول الكل' : 'Accept all'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CookieBanner;
