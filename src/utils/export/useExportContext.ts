import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Report metadata every export shares: who generated it, in which language,
 * and whether the sheet should open right-to-left.
 */
export function useExportContext() {
  const { i18n } = useTranslation();
  const { user } = useAuth();

  return useMemo(() => {
    const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
    const author =
      (typeof meta.full_name === 'string' && meta.full_name) ||
      (typeof meta.name === 'string' && meta.name) ||
      user?.email ||
      undefined;
    const locale = i18n.language?.startsWith('ar') ? 'ar' : 'en-US';
    return { author: author || undefined, locale, rtl: i18n.language?.startsWith('ar') ?? false };
  }, [user, i18n.language]);
}
