
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
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    const isInWebAppiOS = (window.navigator as any).standalone === true;
    if (standalone || isInWebAppiOS) { setIsInstalled(true); return; }

    // Notification opt-in is NOT auto-shown to first-time visitors browsing the
    // public site. It is only offered after the user installs the app.


    const handlePrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };
    const handleInstalled = () => { setIsInstalled(true); setShowPrompt(false); maybeOfferNotifications(); };

    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('appinstalled', handleInstalled);

    // Show for iOS users too
    if (isIOS()) setShowPrompt(true);

    return () => { window.removeEventListener('beforeinstallprompt', handlePrompt); window.removeEventListener('appinstalled', handleInstalled); };
  }, []);

  const maybeOfferNotifications = () => {
    if (localStorage.getItem('pwa-notifications-disabled')) return;
    if ('Notification' in window && Notification.permission === 'default') setShowNotificationPrompt(true);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) { if (isIOS()) setShowIOSModal(true); return; }
    try {
      await deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === 'accepted') { setIsInstalled(true); maybeOfferNotifications(); }
      setDeferredPrompt(null); setShowPrompt(false);
    } catch (error) { console.error('Install error:', error); }
  };

  const dismiss = () => { setShowPrompt(false); sessionStorage.setItem('pwa-install-dismissed', 'true'); };

  const handleEnableNotifications = async () => {
    if ('Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          setNotificationsEnabled(true);
          localStorage.setItem('pwa-notifications-enabled', 'true');
          setShowNotificationPrompt(false);
        } else {
          localStorage.setItem('pwa-notifications-disabled', 'true');
          setShowNotificationPrompt(false);
        }
      } catch (error) {
        console.error('Notification permission error:', error);
        localStorage.setItem('pwa-notifications-disabled', 'true');
        setShowNotificationPrompt(false);
      }
    }
  };

  const dismissNotificationPrompt = () => {
    localStorage.setItem('pwa-notifications-disabled', 'true');
    setShowNotificationPrompt(false);
  };

  const hideInstallUi = isInstalled || !!sessionStorage.getItem('pwa-install-dismissed') || !showPrompt;

  return (
    <>
      {!hideInstallUi && (<>
      {/* Fixed floating pill button - all devices */}
      <div className="fixed bottom-24 md:bottom-6 right-3 md:right-6 z-40 animate-fade-in">
        <div className="flex items-center gap-2 bg-primary text-primary-foreground rounded-full shadow-lg px-3 py-2 md:px-4 md:py-2.5">
          <button onClick={dismiss} aria-label={t('common.close', 'Close')} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground">
            <X className="h-4 w-4" />
          </button>
          <Button size="sm" onClick={handleInstall} className="text-xs md:text-sm">
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
      </>)}

       {/* Notification Opt-in Prompt */}
       <Dialog open={showNotificationPrompt} onOpenChange={setShowNotificationPrompt}>
         <DialogContent className="max-w-sm" dir={dir}>
           <DialogHeader>
             <DialogTitle className="text-center">{t('pwa.notificationTitle')}</DialogTitle>
             <DialogDescription className="text-center">{t('pwa.notificationDesc')}</DialogDescription>
           </DialogHeader>
           <div className="flex gap-3">
             <Button variant="outline" onClick={dismissNotificationPrompt} className="flex-1">{t('pwa.notificationSkip')}</Button>
             <Button onClick={handleEnableNotifications} className="flex-1 bg-accent hover:bg-accent/90">{t('pwa.notificationEnable')}</Button>
           </div>
         </DialogContent>
       </Dialog>
    </>
  );
};

export default PWAInstaller;
