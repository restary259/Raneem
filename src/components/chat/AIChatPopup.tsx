
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Send, Bot, User, Loader2, WifiOff, Maximize2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAIChat } from '@/hooks/useAIChat';
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
    <Card className="flex flex-col h-[550px] max-h-[80vh] shadow-2xl rounded-2xl overflow-hidden bg-background/95 backdrop-blur-sm border-white/20" dir={dir}>
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
            <Button variant="ghost" size="icon" className="hover:bg-white/20 text-white shrink-0" title={t('chat.openFullPage')}>
              <Maximize2 className="h-4 w-4" />
            </Button>
          </Link>
          <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-white/20 text-white shrink-0">
            <X className="h-5 w-5" />
          </Button>
        </div>
      </CardHeader>

      {!isOnline && (
        <div className="bg-amber-50 px-3 py-1.5 flex items-center gap-2 text-amber-700 text-xs border-b border-amber-200">
          <WifiOff className="h-3 w-3" />
          <span>{t('chat.offlineNotice')}</span>
        </div>
      )}

      <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-center text-muted-foreground">
              {t('chat.emptyState')}
            </p>
            <div className="space-y-2">
              <p className="text-xs text-center text-muted-foreground font-medium">{t('chat.quickQuestionsTitle')}</p>
              {quickQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q)}
                  className="w-full text-sm p-2 rounded-lg border hover:bg-secondary hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                  style={{ textAlign: dir === 'rtl' ? 'right' : 'left' }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center shrink-0 mt-1">
                <User className="h-4 w-4 text-orange-600" />
              </div>
            )}
            <div
              className={`max-w-[80%] p-3 rounded-xl text-sm whitespace-pre-wrap leading-relaxed animate-fade-in ${
                msg.role === 'user'
                  ? 'bg-orange-50 text-foreground rounded-tr-sm'
                  : 'bg-secondary text-foreground rounded-tl-sm'
              }`}
            >
              {msg.content}
            </div>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-1">
                <Bot className="h-4 w-4 text-blue-600" />
              </div>
            )}
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex gap-2 justify-end">
            <div className="p-3 rounded-xl bg-secondary">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-1">
              <Bot className="h-4 w-4 text-blue-600" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </CardContent>

      <div className="p-3 border-t shrink-0">
        <form
          onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
          className="flex gap-2"
        >
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading}
            className="bg-orange-500 hover:bg-orange-600 shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('chat.placeholder')}
            className="flex-1"
            disabled={isLoading}
          />
        </form>
      </div>
    </Card>
  );
};

export default AIChatPopup;
