
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Download, Share } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useTranslation } from 'react-i18next';
import { useDirection } from '@/hooks/useDirection';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

const PWAInstaller = () => {
  const { t } = useTranslation('common');
  const { dir } = useDirection();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    const isInWebAppiOS = (window.navigator as any).standalone === true;
    if (standalone || isInWebAppiOS) { setIsInstalled(true); return; }

    const handlePrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };
    const handleInstalled = () => { setIsInstalled(true); setShowPrompt(false); };

    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('appinstalled', handleInstalled);

    // Show for iOS users too
    if (isIOS()) setShowPrompt(true);

    return () => { window.removeEventListener('beforeinstallprompt', handlePrompt); window.removeEventListener('appinstalled', handleInstalled); };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) { if (isIOS()) setShowIOSModal(true); return; }
    try {
      await deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === 'accepted') setIsInstalled(true);
      setDeferredPrompt(null); setShowPrompt(false);
    } catch (error) { console.error('Install error:', error); }
  };

  const dismiss = () => { setShowPrompt(false); sessionStorage.setItem('pwa-install-dismissed', 'true'); };

  if (isInstalled || sessionStorage.getItem('pwa-install-dismissed') || !showPrompt) return null;

  return (
    <>
      {/* Fixed floating pill button - all devices */}
      <div className="fixed bottom-24 md:bottom-6 right-3 md:right-6 z-40 animate-fade-in">
        <div className="flex items-center gap-2 bg-primary text-primary-foreground rounded-full shadow-lg px-3 py-2 md:px-4 md:py-2.5">
          <button onClick={dismiss} className="text-primary-foreground/70 hover:text-primary-foreground shrink-0">
            <X className="h-3.5 w-3.5" />
          </button>
          <Button size="sm" onClick={handleInstall} className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-full text-xs md:text-sm h-7 md:h-8 px-3">
            <Download className="h-3 w-3 md:h-4 md:w-4 mr-1" />{t('pwa.installNow')}
          </Button>
        </div>
      </div>

      <Dialog open={showIOSModal} onOpenChange={setShowIOSModal}>
        <DialogContent className="max-w-sm" dir={dir}>
          <DialogHeader>
            <DialogTitle className="text-center">{t('pwa.iosTitle')}</DialogTitle>
            <DialogDescription className="text-center">{t('pwa.iosDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0 font-bold text-accent">1</div>
              <div><p className="font-medium">{t('pwa.iosStep1Title')}</p><p className="text-sm text-muted-foreground flex items-center gap-1">{t('pwa.iosStep1Desc')} <Share className="h-4 w-4 inline" /></p></div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0 font-bold text-accent">2</div>
              <div><p className="font-medium">{t('pwa.iosStep2Title')}</p><p className="text-sm text-muted-foreground">{t('pwa.iosStep2Desc')}</p></div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center shrink-0 font-bold text-accent">3</div>
              <div><p className="font-medium">{t('pwa.iosStep3Title')}</p><p className="text-sm text-muted-foreground">{t('pwa.iosStep3Desc')}</p></div>
            </div>
          </div>
          <Button onClick={() => { setShowIOSModal(false); dismiss(); }} className="w-full bg-accent hover:bg-accent/90">{t('pwa.understood')}</Button>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PWAInstaller;
