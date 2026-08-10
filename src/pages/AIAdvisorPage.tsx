
import React from 'react';
import Header from '@/components/landing/Header';
import { Button } from '@/components/ui/button';
import { Bot, Trash2, GraduationCap, FileText, Globe, Home as HomeIcon } from 'lucide-react';
import { useAIChat } from '@/hooks/useAIChat';
import SEOHead from '@/components/common/SEOHead';
import ChatCategoryGrid, { type ChatCategory } from '@/components/chat/ChatCategoryGrid';
import ChatComposer from '@/components/chat/ChatComposer';
import ChatMessageList from '@/components/chat/ChatMessageList';
import ChatOfflineBanner from '@/components/chat/ChatOfflineBanner';
import ChatQuickQuestions from '@/components/chat/ChatQuickQuestions';
import { useTranslation } from 'react-i18next';
import { useDirection } from '@/hooks/useDirection';

const AIAdvisorPage = () => {
  const { t } = useTranslation();
  const { dir } = useDirection();
  const quickQuestions = t('quickQuestions', { returnObjects: true }) as string[];

  const CATEGORIES: ChatCategory[] = [
    { label: t('advisor.categories.admissions'), icon: GraduationCap, color: 'bg-brand-strong/10 text-brand-strong' },
    { label: t('advisor.categories.visa'), icon: FileText, color: 'bg-blue-100 text-blue-600' },
    { label: t('advisor.categories.language'), icon: Globe, color: 'bg-green-100 text-green-600' },
    { label: t('advisor.categories.life'), icon: HomeIcon, color: 'bg-purple-100 text-purple-600' },
  ];

  const {
    messages,
    input,
    setInput,
    isLoading,
    isOnline,
    inputRef,
    messagesEndRef,
    sendMessage,
    clearHistory,
  } = useAIChat(true);

  return (
    <div className="h-[100dvh] flex flex-col bg-background overflow-hidden" dir={dir}>
      <SEOHead title={t('seo.advisorTitle')} description={t('seo.advisorDesc')} />
      <Header />

      <main className="flex-1 flex flex-col max-w-4xl mx-auto w-full min-h-0">
        {!isOnline && <ChatOfflineBanner message={t('chat.offlineBanner')} className="flex-shrink-0" />}

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 min-h-0" style={{ WebkitOverflowScrolling: 'touch' }}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 md:py-12 space-y-6 md:space-y-8">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand to-brand/70 flex items-center justify-center mx-auto shadow-lg">
                  <Bot className="h-8 w-8 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-foreground">{t('advisor.title')}</h1>
                <p className="text-muted-foreground max-w-md">
                  {t('advisor.description')}
                </p>
              </div>

              <ChatCategoryGrid categories={CATEGORIES} />

              <div className="w-full max-w-lg space-y-2">
                <p className="text-sm text-muted-foreground font-medium text-center">{t('chat.startQuestion')}</p>
                <ChatQuickQuestions questions={quickQuestions} onSelect={sendMessage} />
              </div>
            </div>
          ) : (
            <>
              <div className="flex justify-center">
                <Button variant="ghost" size="sm" onClick={clearHistory} className="text-muted-foreground text-xs gap-1">
                  <Trash2 className="h-3 w-3" />
                  {t('chat.clearHistory')}
                </Button>
              </div>

              <ChatMessageList
                messages={messages}
                isLoading={isLoading}
                userAvatarClassName="bg-brand-strong/10"
                userIconClassName="text-brand-strong"
                userBubbleClassName="bg-brand-strong/5"
              />
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Sticky input bar - close to bottom like ChatGPT */}
        <div className="border-t bg-background p-3 md:p-4 flex-shrink-0 pb-safe">
          <ChatComposer
            value={input}
            onChange={setInput}
            onSubmit={() => sendMessage(input)}
            placeholder={t('chat.placeholder')}
            isLoading={isLoading}
            inputRef={inputRef}
            sendClassName="bg-brand-strong text-brand-foreground hover:bg-brand-strong/90"
            className="max-w-2xl mx-auto"
          />
        </div>
      </main>
    </div>
  );
};

export default AIAdvisorPage;
