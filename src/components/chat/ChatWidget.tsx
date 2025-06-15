
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare, X } from 'lucide-react';
import ChatPopup from './ChatPopup';

const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-[999]">
        <Button 
          onClick={toggleChat} 
          size="icon" 
          className="rounded-full h-16 w-16 bg-accent shadow-lg hover:bg-accent/90 transition-transform hover:scale-110"
        >
          {isOpen ? <X className="h-8 w-8 text-primary-foreground" /> : <MessageSquare className="h-8 w-8 text-primary-foreground" />}
        </Button>
      </div>
      {isOpen && <ChatPopup onClose={toggleChat} />}
    </>
  );
};

export default ChatWidget;
