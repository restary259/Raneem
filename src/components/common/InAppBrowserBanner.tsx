
import { useState, useEffect } from "react";
import { X, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";

const isInAppBrowser = () => {
  const ua = navigator.userAgent || '';
  return /FBAN|FBAV|Instagram|Line\/|WhatsApp|Snapchat/i.test(ua);
};

const InAppBrowserBanner = () => {
  const [visible, setVisible] = useState(false);
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  useEffect(() => {
    if (isInAppBrowser() && !sessionStorage.getItem('inapp-dismissed')) {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    setVisible(false);
    sessionStorage.setItem('inapp-dismissed', '1');
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href).catch(() => {});
  };

  if (!visible) return null;

  return (
    <div className="fixed top-0 inset-x-0 z-[9999] bg-accent text-accent-foreground px-4 py-2.5 flex items-center justify-between gap-2 text-sm shadow-md" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <ExternalLink className="w-4 h-4 shrink-0" />
        <span className="truncate">
          {isAr ? 'للحصول على أفضل تجربة، افتح في Safari أو Chrome' : 'For the best experience, open in Safari or Chrome'}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={copyLink} className="underline text-xs whitespace-nowrap">
          {isAr ? 'نسخ الرابط' : 'Copy link'}
        </button>
        <button onClick={dismiss} aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default InAppBrowserBanner;
