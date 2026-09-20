
import { useTranslation } from 'react-i18next';
import { isRtlLng } from '@/i18n';

export const useDirection = () => {
  const { i18n } = useTranslation();
  const isRtl = isRtlLng(i18n.language);
  return {
    dir: isRtl ? 'rtl' as const : 'ltr' as const,
    isRtl,
    textAlign: isRtl ? 'text-right' : 'text-left',
    sheetSide: isRtl ? 'right' as const : 'left' as const,
  };
};
