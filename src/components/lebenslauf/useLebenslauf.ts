import { useState, useEffect, useCallback } from 'react';
import { CVData, createEmptyCVData } from './types';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

const STORAGE_KEY = 'lebenslauf-draft';

export const useLebenslauf = () => {
  const { toast } = useToast();
  const { t } = useTranslation('resources');
  const [data, setData] = useState<CVData>(createEmptyCVData);

  const updateData = useCallback((partial: Partial<CVData>) => {
    setData(prev => ({ ...prev, ...partial }));
  }, []);

  const updatePersonal = useCallback((partial: Partial<CVData['personal']>) => {
    setData(prev => ({ ...prev, personal: { ...prev.personal, ...partial } }));
  }, []);

  const saveDraft = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    toast({ title: t('lebenslaufBuilder.draftSaved') });
  }, [data, toast, t]);

  const loadDraft = useCallback(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setData(JSON.parse(saved));
      toast({ title: t('lebenslaufBuilder.draftLoaded') });
    } else {
      toast({ title: t('lebenslaufBuilder.noDraft'), variant: 'destructive' });
    }
  }, [toast, t]);

  const clearAll = useCallback(() => {
    setData(createEmptyCVData());
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return { data, setData, updateData, updatePersonal, saveDraft, loadDraft, clearAll, handlePrint };
};
