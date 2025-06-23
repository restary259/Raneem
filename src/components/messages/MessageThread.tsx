
import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Message, Conversation } from '@/hooks/useConversations';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Send, Paperclip } from 'lucide-react';

interface MessageThreadProps {
  conversation: Conversation;
  messages: Message[];
  currentUserId: string;
  onSendMessage: (content: string, attachments?: File[]) => void;
  isLoading?: boolean;
}

const MessageThread: React.FC<MessageThreadProps> = ({
  conversation,
  messages,
  currentUserId,
  onSendMessage,
  isLoading = false
}) => {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (newMessage.trim()) {
      onSendMessage(newMessage.trim());
      setNewMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getConversationTitle = () => {
    if (conversation.title) return conversation.title;
    
    if (conversation.type === 'direct') {
      const otherMember = conversation.members.find(m => m.user_id !== currentUserId);
      return otherMember?.profile.full_name || 'Unknown User';
    }
    
    return `Group (${conversation.members.length} members)`;
  };

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center space-x-3 space-x-reverse">
          <Avatar className="h-8 w-8">
            <AvatarImage src={conversation.members[0]?.profile.avatar_url} />
            <AvatarFallback>
              {getConversationTitle().charAt(0)}
            </AvatarFallback>
          </Avatar>
          <span>{getConversationTitle()}</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 max-h-96">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => {
            const isOwn = message.sender_id === currentUserId;
            return (
              <div
                key={message.id}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    isOwn
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  {!isOwn && (
                    <div className="flex items-center space-x-2 space-x-reverse mb-1">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={message.sender.avatar_url} />
                        <AvatarFallback className="text-xs">
                          {message.sender.full_name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-medium">
                        {message.sender.full_name}
                      </span>
                    </div>
                  )}
                  
                  <p className="text-sm">{message.content}</p>
                  
                  <div className="text-xs opacity-70 mt-1">
                    {formatDistanceToNow(new Date(message.created_at), {
                      addSuffix: true,
                      locale: ar
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </CardContent>

      <div className="border-t p-4">
        <div className="flex space-x-2 space-x-reverse">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            className="flex-1 min-h-[40px] max-h-[120px]"
            disabled={isLoading}
          />
          
          <div className="flex flex-col space-y-2">
            <Button
              size="icon"
              variant="outline"
              disabled={isLoading}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            
            <Button
              size="icon"
              onClick={handleSend}
              disabled={isLoading || !newMessage.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default MessageThread;
