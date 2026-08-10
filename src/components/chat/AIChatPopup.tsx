
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Bot, Maximize2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAIChat } from '@/hooks/useAIChat';
import ChatComposer from '@/components/chat/ChatComposer';
import ChatMessageList from '@/components/chat/ChatMessageList';
import ChatOfflineBanner from '@/components/chat/ChatOfflineBanner';
import ChatQuickQuestions from '@/components/chat/ChatQuickQuestions';
import { useTranslation } from 'react-i18next';
import { useDirection } from '@/hooks/useDirection';

const AIChatPopup = ({ onClose }: { onClose: () => void }) => {
  const { t } = useTranslation();
  const { dir } = useDirection();
  const quickQuestions = t('quickQuestions', { returnObjects: true }) as string[];

  const {
    messages,
    input,
    setInput,
    isLoading,
    isOnline,
    inputRef,
    messagesEndRef,
    sendMessage,
  } = useAIChat(true);

  return (
    <Card className="flex flex-col h-[550px] max-h-[80vh] shadow-2xl rounded-2xl overflow-hidden bg-background border-white/20" dir={dir}>
      <CardHeader className="flex flex-row items-center justify-between bg-gradient-to-l from-orange-500 to-amber-500 text-white p-4 shrink-0">
        <div className="flex items-center gap-2">
          <Bot className="h-6 w-6" />
          <div>
            <CardTitle className="text-lg">{t('chat.title')}</CardTitle>
            <CardDescription className="text-white/80 text-xs">{t('chat.description')}</CardDescription>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Link to="/ai-advisor">
            <Button variant="ghost" size="icon" aria-label={t('chat.openFullPage')} className="hover:bg-white/20 text-white shrink-0" title={t('chat.openFullPage')}>
              <Maximize2 className="h-4 w-4" />
            </Button>
          </Link>
          <Button variant="ghost" size="icon" aria-label={t('common.close', 'Close')} onClick={onClose} className="hover:bg-white/20 text-white shrink-0">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </CardHeader>

      {!isOnline && <ChatOfflineBanner message={t('chat.offlineNotice')} size="sm" />}

      <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-center text-muted-foreground">
              {t('chat.emptyState')}
            </p>
            <div className="space-y-2">
              <p className="text-xs text-center text-muted-foreground font-medium">{t('chat.quickQuestionsTitle')}</p>
              <ChatQuickQuestions questions={quickQuestions} onSelect={sendMessage} size="sm" />
            </div>
          </div>
        )}

        <ChatMessageList messages={messages} isLoading={isLoading} size="sm" animate />
        <div ref={messagesEndRef} />
      </CardContent>

      <div className="p-3 border-t shrink-0">
        <ChatComposer
          value={input}
          onChange={setInput}
          onSubmit={() => sendMessage(input)}
          placeholder={t('chat.placeholder')}
          isLoading={isLoading}
          inputRef={inputRef}
        />
      </div>
    </Card>
  );
};

export default AIChatPopup;
