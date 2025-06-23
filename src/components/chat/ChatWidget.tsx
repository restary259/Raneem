
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
            ? 'bottom-20 right-4' // Above the mobile footer navigator
            : 'bottom-6 right-6'   // Normal position on desktop
        }`}
      >
        <Button
          onClick={toggleChat}
          className="w-14 h-14 rounded-full bg-orange-500 hover:bg-orange-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center"
          aria-label={isOpen ? 'إغلاق الدردشة' : 'فتح الدردشة'}
        >
          {isOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <MessageCircle className="h-6 w-6" />
          )}
        </Button>
      </div>

      {/* Chat Popup */}
      {isOpen && (
        <div 
          className={`fixed z-50 ${
            isMobile 
              ? 'bottom-36 right-4 left-4' // Above the mobile footer and chat button
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
