
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, X, Smartphone, Monitor, Share } from 'lucide-react';
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
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    const isInWebAppiOS = (window.navigator as any).standalone === true;
    if (standalone || isInWebAppiOS) { setIsInstalled(true); return; }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowInstallPrompt(true), 10000);
    };
    const handleAppInstalled = () => { setIsInstalled(true); setShowInstallPrompt(false); setDeferredPrompt(null); };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt); window.removeEventListener('appinstalled', handleAppInstalled); };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) { if (isIOS()) setShowIOSModal(true); return; }
    try {
      await deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === 'accepted') setIsInstalled(true);
      setDeferredPrompt(null); setShowInstallPrompt(false);
    } catch (error) { console.error('Install error:', error); }
  };

  const dismissPrompt = () => { setShowInstallPrompt(false); sessionStorage.setItem('pwa-install-dismissed', 'true'); };

  if (isInstalled || sessionStorage.getItem('pwa-install-dismissed')) return null;
  if (!showInstallPrompt) return null;

  return (
    <>
      <div className="fixed bottom-20 left-4 right-4 z-40 md:left-auto md:right-4 md:max-w-sm">
        <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white border-0 shadow-xl">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg">
                  <img src="/lovable-uploads/78047579-6b53-42e9-bf6f-a9e19a9e4aba.png" alt="Darb" className="h-6 w-6 filter brightness-0 invert" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">{t('pwa.installTitle')}</h3>
                  <p className="text-sm text-white/90">{t('pwa.installDesc')}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={dismissPrompt} className="text-white hover:bg-white/20 p-1 h-auto"><X className="h-4 w-4" /></Button>
            </div>
            <div className="flex gap-4 mb-4 text-sm">
              <div className="flex items-center gap-2 text-white/90"><Smartphone className="h-4 w-4" /><span>{t('pwa.mobileUse')}</span></div>
              <div className="flex items-center gap-2 text-white/90"><Monitor className="h-4 w-4" /><span>{t('pwa.offlineUse')}</span></div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleInstallClick} className="flex-1 bg-white text-orange-600 hover:bg-gray-100 font-semibold shadow-md">
                <Download className="h-4 w-4 mr-2" />{t('pwa.installNow')}
              </Button>
              <Button variant="ghost" onClick={dismissPrompt} className="text-white hover:bg-white/20 px-3">{t('pwa.later')}</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showIOSModal} onOpenChange={setShowIOSModal}>
        <DialogContent className="max-w-sm" dir={dir}>
          <DialogHeader>
            <DialogTitle className="text-center">{t('pwa.iosTitle')}</DialogTitle>
            <DialogDescription className="text-center">{t('pwa.iosDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0 font-bold text-orange-600">1</div>
              <div><p className="font-medium">{t('pwa.iosStep1Title')}</p><p className="text-sm text-muted-foreground flex items-center gap-1">{t('pwa.iosStep1Desc')} <Share className="h-4 w-4 inline" /></p></div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0 font-bold text-orange-600">2</div>
              <div><p className="font-medium">{t('pwa.iosStep2Title')}</p><p className="text-sm text-muted-foreground">{t('pwa.iosStep2Desc')}</p></div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0 font-bold text-orange-600">3</div>
              <div><p className="font-medium">{t('pwa.iosStep3Title')}</p><p className="text-sm text-muted-foreground">{t('pwa.iosStep3Desc')}</p></div>
            </div>
          </div>
          <Button onClick={() => { setShowIOSModal(false); dismissPrompt(); }} className="w-full bg-orange-500 hover:bg-orange-600">{t('pwa.understood')}</Button>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PWAInstaller;
