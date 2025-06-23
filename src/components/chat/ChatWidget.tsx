
import React, { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ChatPopup from './ChatPopup';
import { useIsMobile } from '@/hooks/use-mobile';

const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  return (
    <>
      {/* Chat Button */}
      <div 
        className={`fixed z-40 ${
          isMobile 
            ? 'bottom-24 right-4' // Above the mobile footer navigator with more spacing
            : 'bottom-6 right-6'   // Normal position on desktop
        }`}
      >
        <Button
          onClick={toggleChat}
          className={`${
            isMobile ? 'w-12 h-12' : 'w-14 h-14'
          } rounded-full bg-orange-500 hover:bg-orange-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center`}
          aria-label={isOpen ? 'إغلاق الدردشة' : 'فتح الدردشة'}
        >
          {isOpen ? (
            <X className={`${isMobile ? 'h-5 w-5' : 'h-6 w-6'}`} />
          ) : (
            <MessageCircle className={`${isMobile ? 'h-5 w-5' : 'h-6 w-6'}`} />
          )}
        </Button>
      </div>

      {/* Chat Popup */}
      {isOpen && (
        <div 
          className={`fixed z-50 ${
            isMobile 
              ? 'bottom-40 right-4 left-4' // Above the mobile footer and chat button
              : 'bottom-24 right-6 w-80'   // Normal position on desktop
          }`}
        >
          <ChatPopup onClose={() => setIsOpen(false)} />
        </div>
      )}
    </>
  );
};

export default ChatWidget;
