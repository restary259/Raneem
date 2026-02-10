
import React from 'react';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Bot, User, Loader2, Trash2, WifiOff, GraduationCap, FileText, Globe, Home as HomeIcon } from 'lucide-react';
import { useAIChat } from '@/hooks/useAIChat';
import SEOHead from '@/components/common/SEOHead';
import { useTranslation } from 'react-i18next';
import { useDirection } from '@/hooks/useDirection';

const AIAdvisorPage = () => {
  const { t } = useTranslation();
  const { dir } = useDirection();
  const quickQuestions = t('quickQuestions', { returnObjects: true }) as string[];

  const CATEGORIES = [
    { label: t('advisor.categories.admissions'), icon: GraduationCap, color: 'bg-orange-100 text-orange-600' },
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
    <div className="min-h-screen bg-background flex flex-col" dir={dir}>
      <SEOHead title={t('seo.advisorTitle')} description={t('seo.advisorDesc')} />
      <Header />

      <main className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
        {!isOnline && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-amber-700 text-sm">
            <WifiOff className="h-4 w-4 shrink-0" />
            <span>{t('chat.offlineBanner')}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-8">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center mx-auto shadow-lg">
                  <Bot className="h-8 w-8 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-foreground">{t('advisor.title')}</h1>
                <p className="text-muted-foreground max-w-md">
                  {t('advisor.description')}
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full max-w-lg">
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <div key={cat.label} className={`flex flex-col items-center gap-2 p-3 rounded-xl ${cat.color} cursor-default`}>
                      <Icon className="h-5 w-5" />
                      <span className="text-xs font-medium text-center">{cat.label}</span>
                    </div>
                  );
                })}
              </div>

              <div className="w-full max-w-lg space-y-2">
                <p className="text-sm text-muted-foreground font-medium text-center">{t('chat.startQuestion')}</p>
                {quickQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(q)}
                    className="w-full text-sm p-3 rounded-xl border hover:bg-secondary transition-colors"
                    style={{ textAlign: dir === 'rtl' ? 'right' : 'left' }}
                  >
                    {q}
                  </button>
                ))}
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

              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0 mt-1">
                      <User className="h-4 w-4 text-orange-600" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] p-4 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-orange-50 text-foreground rounded-tr-sm'
                        : 'bg-secondary text-foreground rounded-tl-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-1">
                      <Bot className="h-4 w-4 text-blue-600" />
                    </div>
                  )}
                </div>
              ))}

              {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                <div className="flex gap-3 justify-end">
                  <div className="p-4 rounded-2xl bg-secondary">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 mt-1">
                    <Bot className="h-4 w-4 text-blue-600" />
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t bg-background p-3 md:p-4 sticky bottom-0 pb-20 md:pb-4">
          <form
            onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
            className="flex gap-2 max-w-2xl mx-auto"
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
      </main>

      <Footer />
    </div>
  );
};

export default AIAdvisorPage;
