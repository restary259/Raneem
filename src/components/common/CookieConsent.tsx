
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Cookie, X } from 'lucide-react';

const CookieConsent = () => {
  const [showConsent, setShowConsent] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      const timer = setTimeout(() => {
        setShowConsent(true);
      }, 3000); // Show after 3 seconds
      
      return () => clearTimeout(timer);
    }
  }, []);

  const acceptCookies = () => {
    localStorage.setItem('cookie-consent', 'accepted');
    setShowConsent(false);
  };

  const rejectCookies = () => {
    localStorage.setItem('cookie-consent', 'rejected');
    setShowConsent(false);
  };

  if (!showConsent) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-md">
      <Card className="p-4 bg-background/95 backdrop-blur-sm border shadow-lg">
        <div className="flex items-start gap-3">
          <Cookie className="h-5 w-5 text-primary mt-1 shrink-0" />
          <div className="space-y-3 flex-1">
            <h3 className="font-semibold text-sm">استخدام ملفات تعريف الارتباط</h3>
            <p className="text-xs text-muted-foreground">
              نستخدم ملفات تعريف الارتباط لتحسين تجربتك وتقديم محتوى مخصص. 
              بالمتابعة، فإنك توافق على استخدام هذه الملفات.
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={acceptCookies} className="text-xs">
                موافق
              </Button>
              <Button size="sm" variant="outline" onClick={rejectCookies} className="text-xs">
                رفض
              </Button>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => setShowConsent(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default CookieConsent;
