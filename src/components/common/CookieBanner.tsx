
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDirection } from '@/hooks/useDirection';
import { Cookie } from 'lucide-react';

const COOKIE_STORAGE_KEY = 'darb_cookie_consent';

const CookieBanner = () => {
  const [visible, setVisible] = useState(false);
  const { dir } = useDirection();
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  useEffect(() => {
    // Use localStorage for persistence (survives session, not affected by login/logout)
    const stored = localStorage.getItem(COOKIE_STORAGE_KEY);
    if (!stored) {
      // Small delay to avoid blocking initial render and interfering with other UI
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const accept = (level: string) => {
    localStorage.setItem(COOKIE_STORAGE_KEY, level);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-20 md:bottom-6 inset-x-4 md:inset-x-8 z-[55] rounded-xl p-4 shadow-xl bg-card border border-border text-card-foreground text-sm animate-in slide-in-from-bottom-4"
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
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => accept('necessary')}
            className="px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors"
          >
            {isAr ? 'الضرورية فقط' : 'Only necessary'}
          </button>
          <button
            onClick={() => accept('all')}
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
