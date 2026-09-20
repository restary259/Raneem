import React from 'react';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import DarbPageHero from '@/components/common/DarbPageHero';
import { DARB_PUBLIC_HERO_IMAGES } from '@/config/publicHeroImages';
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
    <div className="min-h-screen overflow-x-hidden bg-background" dir={dir}>
      <SEOHead title={t('seo.advisorTitle')} description={t('seo.advisorDesc')} />
      <Header />

      <DarbPageHero
        compact
        className="min-h-[380px] md:min-h-[470px]"
        eyebrow={t('advisor.title')}
        imageUrl={DARB_PUBLIC_HERO_IMAGES.advisor}
        imageAlt={t('advisor.imageAlt', 'Student researching university options')}
        title={t('advisor.title')}
        subtitle={t('advisor.description')}
      />

      <main className="container mx-auto w-full max-w-5xl px-3 py-5 sm:px-4 md:py-8">
        <section
          aria-label={t('advisor.title')}
          className="overflow-hidden rounded-xl border border-border bg-background shadow-surface"
        >
          {!isOnline && (
            <ChatOfflineBanner
              message={t('chat.offlineBanner')}
              className="border-b flex-shrink-0"
            />
          )}

          <div
            className="min-h-[420px] overflow-y-auto p-3 sm:p-5 md:min-h-[500px] md:p-6"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {messages.length === 0 ? (
              <div className="flex min-h-[390px] flex-col items-center justify-center gap-5 py-6 md:min-h-[455px] md:gap-7">
                <div className="space-y-3 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-strong/10 text-brand-strong">
                    <Bot className="h-7 w-7" />
                  </div>
                  <h1 className="text-xl font-bold text-foreground md:text-2xl">
                    {t('advisor.title')}
                  </h1>
                  <p className="mx-auto max-w-xl text-sm leading-6 text-muted-foreground md:text-base">
                    {t('advisor.description')}
                  </p>
                </div>

                <ChatCategoryGrid categories={CATEGORIES} />

                <div className="w-full max-w-lg space-y-2">
                  <p className="text-center text-sm font-medium text-muted-foreground">
                    {t('chat.startQuestion')}
                  </p>
                  <ChatQuickQuestions questions={quickQuestions} onSelect={sendMessage} />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearHistory}
                    className="gap-1 text-xs text-muted-foreground"
                  >
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
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Keep the composer visible and reachable on every viewport instead of
              letting the page-level footer consume the flex layout. */}
          <div className="sticky bottom-0 z-10 border-t bg-background/95 p-3 backdrop-blur-sm sm:p-4 md:p-5">
            <ChatComposer
              value={input}
              onChange={setInput}
              onSubmit={() => sendMessage(input)}
              placeholder={t('chat.placeholder')}
              isLoading={isLoading}
              inputRef={inputRef}
              sendClassName="bg-brand-strong text-brand-foreground hover:bg-brand-strong/90"
              className="mx-auto w-full max-w-3xl"
            />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default AIAdvisorPage;
