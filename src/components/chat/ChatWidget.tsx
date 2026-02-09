
import React, { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AIChatPopup from './AIChatPopup';
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
      <div className="fixed z-40 chat-btn">
        <Button
          onClick={toggleChat}
          className="w-full h-full rounded-full bg-orange-500 hover:bg-orange-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center"
          aria-label={isOpen ? 'إغلاق الدردشة' : 'فتح الدردشة'}
        >
          {isOpen ? (
            <X className="w-1/2 h-1/2" />
          ) : (
            <MessageCircle className="w-1/2 h-1/2" />
          )}
        </Button>
      </div>

      {/* Chat Popup */}
      {isOpen && (
        <div 
          className={`fixed z-50 ${
            isMobile 
              ? 'bottom-40 right-4 left-4'
              : 'bottom-24 right-6 w-96'
          }`}
        >
          <AIChatPopup onClose={() => setIsOpen(false)} />
        </div>
      )}
    </>
  );
};

export default ChatWidget;
