
import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Message, Conversation } from '@/types/communications';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Send, Paperclip, Image } from 'lucide-react';

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
  const [attachments, setAttachments] = useState<File[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (newMessage.trim() || attachments.length > 0) {
      onSendMessage(newMessage.trim(), attachments);
      setNewMessage('');
      setAttachments([]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments(prev => [...prev, ...files]);
  };

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center space-x-3 space-x-reverse">
          <Avatar className="h-8 w-8">
            <AvatarImage src={conversation.members?.[0]?.profile?.avatar_url} />
            <AvatarFallback>
              {conversation.members?.[0]?.profile?.full_name?.charAt(0) || 'م'}
            </AvatarFallback>
          </Avatar>
          <span>
            {conversation.type === 'system' 
              ? 'إعلانات النظام'
              : conversation.members?.[0]?.profile?.full_name || 'محادثة'
            }
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => {
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
                      <AvatarImage src={message.sender?.avatar_url} />
                      <AvatarFallback className="text-xs">
                        {message.sender?.full_name?.charAt(0) || 'م'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium">
                      {message.sender?.full_name}
                    </span>
                  </div>
                )}
                
                <p className="text-sm">{message.content}</p>
                
                {message.attachments && message.attachments.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {message.attachments.map((attachment, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        <Paperclip className="h-3 w-3 ml-1" />
                        {attachment.name}
                      </Badge>
                    ))}
                  </div>
                )}
                
                <div className="text-xs opacity-70 mt-1">
                  {formatDistanceToNow(new Date(message.created_at), {
                    addSuffix: true,
                    locale: ar
                  })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </CardContent>

      {conversation.type !== 'system' && (
        <div className="border-t p-4">
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {attachments.map((file, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {file.name}
                  <button
                    onClick={() => setAttachments(prev => prev.filter((_, i) => i !== index))}
                    className="ml-1 text-red-500 hover:text-red-700"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          )}
          
          <div className="flex space-x-2 space-x-reverse">
            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="اكتب رسالتك..."
              className="flex-1 min-h-[40px] max-h-[120px]"
              disabled={isLoading}
            />
            
            <div className="flex flex-col space-y-2">
              <Button
                size="icon"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              
              <Button
                size="icon"
                onClick={handleSend}
                disabled={isLoading || (!newMessage.trim() && attachments.length === 0)}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <Input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.txt"
          />
        </div>
      )}
    </Card>
  );
};

export default MessageThread;
