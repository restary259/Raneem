
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, MessageCircle } from 'lucide-react';

const EntryPopup = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasShown, setHasShown] = useState(false);

  useEffect(() => {
    // Check if popup has been shown in this session
    const popupShown = sessionStorage.getItem('entryPopupShown');
    
    if (!popupShown && !hasShown) {
      const timer = setTimeout(() => {
        setIsOpen(true);
        setHasShown(true);
        sessionStorage.setItem('entryPopupShown', 'true');
      }, 10000); // Show after 10 seconds

      return () => clearTimeout(timer);
    }
  }, [hasShown]);

  const handleWhatsAppClick = () => {
    window.open('https://wa.me/972529402168', '_blank');
    setIsOpen(false);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md mx-4 rounded-lg">
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-4 h-8 w-8"
          onClick={handleClose}
        >
          <X className="h-4 w-4" />
        </Button>
        
        <DialogHeader className="text-center space-y-4">
          <DialogTitle className="text-2xl font-bold text-primary">
            عرض خاص لفترة محدودة!
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 pt-4">
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <MessageCircle className="h-8 w-8 text-green-600" />
            </div>
            
            <p className="text-lg text-muted-foreground">
              احجز استشارتك الآن عبر الواتساب
            </p>
            
            <p className="text-sm text-muted-foreground">
              احصل على استشارة مجانية لمدة 30 دقيقة مع خبرائنا المتخصصين
            </p>
          </div>
          
          <Button 
            onClick={handleWhatsAppClick}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-3 text-lg"
            size="lg"
          >
            <MessageCircle className="h-5 w-5 ml-2" />
            تواصل معنا
          </Button>
          
          <p className="text-xs text-center text-muted-foreground">
            * العرض صالح لفترة محدودة
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EntryPopup;
