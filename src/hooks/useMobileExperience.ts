
import { useState, useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePWA } from '@/hooks/usePWA';

interface MobileExperience {
  isMobile: boolean;
  isStandalone: boolean;
  canInstall: boolean;
  isOnline: boolean;
  vibrate: (pattern?: number | number[]) => void;
  showInstallPrompt: () => void;
  shareApp: () => void;
}

export const useMobileExperience = (): MobileExperience => {
  const isMobile = useIsMobile();
  const { isInstallable, isInstalled, isOnline, install, shareApp } = usePWA();
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if app is running in standalone mode (PWA)
    const checkStandalone = () => {
      const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;
      const isInWebApp = (window.navigator as any).standalone === true;
      setIsStandalone(isStandaloneMode || isInWebApp);
    };

    checkStandalone();

    // Listen for display mode changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    mediaQuery.addEventListener('change', checkStandalone);

    return () => {
      mediaQuery.removeEventListener('change', checkStandalone);
    };
  }, []);

  const vibrate = (pattern: number | number[] = 50) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  };

  const showInstallPrompt = async () => {
    if (isInstallable) {
      const installed = await install();
      if (installed) {
        vibrate([100, 50, 100]);
      }
    }
  };

  return {
    isMobile,
    isStandalone,
    canInstall: isInstallable && !isInstalled,
    isOnline,
    vibrate,
    showInstallPrompt,
    shareApp,
  };
};
