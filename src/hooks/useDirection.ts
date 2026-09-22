
import { useTranslation } from 'react-i18next';

export const useDirection = () => {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar' || i18n.language === 'he';
  return {
    dir: isRtl ? 'rtl' as const : 'ltr' as const,
    isRtl,
    textAlign: isRtl ? 'text-right' : 'text-left',
    sheetSide: isRtl ? 'right' as const : 'left' as const,
  };
};
