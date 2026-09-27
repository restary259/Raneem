import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Share } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useTranslation } from 'react-i18next';
import { useDirection } from '@/hooks/useDirection';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

/**
 * Persistent "download the app" side tab, stacked directly above the WhatsApp
 * side tab and mirroring its shape so the two read as one column of actions.
 *
 * It is deliberately NOT a popup and offers no dismiss: it stays until the app
 * is actually installed (`appinstalled`, or standalone display mode on launch).
 * On iOS, where no install event ever fires, the tab opens the Add-to-Home
 * instructions instead.
 *
 * The parent (`AppShell`) only mounts this on public pages via
 * `shouldShowFloatingWidgets()`, so it never renders on a dashboard.
 */
const PWAInstaller = () => {
  const { t } = useTranslation('common');
  const { dir } = useDirection();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  // Mirrors `deferredPrompt` so the click handler always sees the live event:
  // React state can lag behind a prompt that arrived in the same tick.
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  const maybeOfferNotifications = useCallback(() => {
    if (localStorage.getItem('pwa-notifications-disabled')) return;
    if ('Notification' in window && Notification.permission === 'default') setShowNotificationPrompt(true);
  }, []);

  useEffect(() => {
    const isStandalone = () =>
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone()) {
      setIsInstalled(true);
      return;
    }

    // Notification opt-in is NOT auto-shown to first-time visitors browsing the
    // public site. It is only offered after the user installs the app.

    const handlePrompt = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setIsInstalled(true);
      deferredPromptRef.current = null;
      setDeferredPrompt(null);
      setShowIOSModal(false);
      maybeOfferNotifications();
    };

    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('appinstalled', handleInstalled);

    // Installing from the browser's own UI (or launching the installed app)
    // flips the display mode without firing `appinstalled`; watch it so the tab
    // retires instead of lingering next to an installed app.
    const media = window.matchMedia('(display-mode: standalone)');
    const handleModeChange = () => {
      if (isStandalone()) setIsInstalled(true);
    };
    media.addEventListener?.('change', handleModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      window.removeEventListener('appinstalled', handleInstalled);
      media.removeEventListener?.('change', handleModeChange);
    };
  }, [maybeOfferNotifications]);

  const handleInstall = async () => {
    const prompt = deferredPromptRef.current ?? deferredPrompt;
    // iOS never fires `beforeinstallprompt`; there is only the manual route.
    if (!prompt) {
      if (isIOS()) setShowIOSModal(true);
      return;
    }
    try {
      await prompt.prompt();
      const result = await prompt.userChoice;
      // The event is single-use, so drop it either way. On a decline the tab
      // stays (the requirement is that it persists until the app is installed)
      // and the browser may hand us a fresh prompt later.
      deferredPromptRef.current = null;
      setDeferredPrompt(null);
      if (result.outcome === 'accepted') {
        setIsInstalled(true);
        maybeOfferNotifications();
      }
    } catch (error) {
      console.error('Install error:', error);
    }
  };

  const handleEnableNotifications = async () => {
    if ('Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
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

  return (
    <>
      {!isInstalled && (
        <div className="pwa-side-tab fixed end-0 bottom-[calc(8.5rem+env(safe-area-inset-bottom))] z-40 md:bottom-[5.25rem]">
          <Button
            type="button"
            size="icon"
            onClick={handleInstall}
            aria-label={t('pwa.installNow')}
            className="ms-auto rounded-e-none bg-primary text-primary-foreground shadow-surface hover:bg-primary/90"
          >
            <Download />
          </Button>
        </div>
      )}

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
          <Button onClick={() => setShowIOSModal(false)} className="w-full bg-accent hover:bg-accent/90">{t('pwa.understood')}</Button>
        </DialogContent>
      </Dialog>

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
