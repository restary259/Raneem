
import React from 'react';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import { Button } from '@/components/ui/button';
import { Trash2, GraduationCap, BookOpen, Target, MessageCircle } from 'lucide-react';
import { toneClasses } from '@/lib/statusTokens';
import { useAIChat } from '@/hooks/useAIChat';
import ChatCategoryGrid, { type ChatCategory } from '@/components/chat/ChatCategoryGrid';
import ChatComposer from '@/components/chat/ChatComposer';
import ChatMessageList from '@/components/chat/ChatMessageList';
import ChatOfflineBanner from '@/components/chat/ChatOfflineBanner';
import ChatQuickQuestions from '@/components/chat/ChatQuickQuestions';
import { useTranslation } from 'react-i18next';
import { useDirection } from '@/hooks/useDirection';

const AIQuizChat = () => {
  const { t } = useTranslation();
  const { dir } = useDirection();
  const quizQuickQuestions = t('quiz.quickQuestions', { returnObjects: true }) as string[];

  const CATEGORIES: ChatCategory[] = [
    { label: t('quiz.categories.background'), icon: BookOpen, color: toneClasses('contacted').chip },
    { label: t('quiz.categories.interests'), icon: Target, color: toneClasses('submitted').chip },
    { label: t('quiz.categories.strengths'), icon: GraduationCap, color: toneClasses('enrolled').chip },
    { label: t('quiz.categories.goals'), icon: MessageCircle, color: toneClasses('appointment').chip },
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
  } = useAIChat(false, 'quiz');

  return (
    <div className="min-h-screen bg-background flex flex-col" dir={dir}>
      <Header />

      <main className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
        {!isOnline && <ChatOfflineBanner message={t('chat.offlineBanner')} />}

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-8">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center mx-auto shadow-lg">
                  <GraduationCap className="h-8 w-8 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-foreground">{t('quiz.title')}</h1>
                <p className="text-muted-foreground max-w-md">
                  {t('quiz.description')}
                </p>
              </div>

              <ChatCategoryGrid categories={CATEGORIES} />

              <div className="w-full max-w-lg space-y-2">
                <p className="text-sm text-muted-foreground font-medium text-center">{t('chat.startQuestion')}</p>
                <ChatQuickQuestions questions={quizQuickQuestions} onSelect={sendMessage} />
              </div>
            </div>
          ) : (
            <>
              <div className="flex justify-center">
                <Button variant="ghost" size="sm" onClick={clearHistory} className="text-muted-foreground text-xs gap-1">
                  <Trash2 className="h-3 w-3" />
                  {t('quiz.newConversation')}
                </Button>
              </div>

              <ChatMessageList messages={messages} isLoading={isLoading} animate />
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t bg-background p-3 md:p-4 sticky bottom-0 pb-20 md:pb-4">
          <ChatComposer
            value={input}
            onChange={setInput}
            onSubmit={() => sendMessage(input)}
            placeholder={t('quiz.inputPlaceholder')}
            isLoading={isLoading}
            inputRef={inputRef}
            className="max-w-2xl mx-auto"
          />
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AIQuizChat;
