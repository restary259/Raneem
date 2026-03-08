
import { useState, useEffect } from "react";
import { X, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";

const isInAppBrowser = () => {
  const ua = navigator.userAgent || '';
  return /FBAN|FBAV|Instagram|Line\/|WhatsApp|Snapchat/i.test(ua);
};

const InAppBrowserBanner = () => {
  const [visible, setVisible] = useState(false);
  const { t, i18n } = useTranslation();

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

  const isRtl = i18n.language === 'ar';

  return (
    <div className="fixed top-0 inset-x-0 z-[9999] bg-accent text-accent-foreground px-4 py-2.5 flex items-center justify-between gap-2 text-sm shadow-md" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <ExternalLink className="w-4 h-4 shrink-0" />
        <span className="truncate">
          {t('inAppBannerText')}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={copyLink} className="underline text-xs whitespace-nowrap">
          {t('copyLink')}
        </button>
        <button onClick={dismiss} aria-label="Close">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default InAppBrowserBanner;
