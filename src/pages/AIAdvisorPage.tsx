
import React from 'react';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Bot, User, Loader2, Trash2, WifiOff, GraduationCap, FileText, Globe, Home as HomeIcon } from 'lucide-react';
import { useAIChat, QUICK_QUESTIONS } from '@/hooks/useAIChat';

const CATEGORIES = [
  { label: 'القبول الجامعي', icon: GraduationCap, color: 'bg-orange-100 text-orange-600' },
  { label: 'التأشيرة والسفر', icon: FileText, color: 'bg-blue-100 text-blue-600' },
  { label: 'اللغة والتحضير', icon: Globe, color: 'bg-green-100 text-green-600' },
  { label: 'الحياة في ألمانيا', icon: HomeIcon, color: 'bg-purple-100 text-purple-600' },
];

const AIAdvisorPage = () => {
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
  } = useAIChat(true); // persist history

  return (
    <div className="min-h-screen bg-background flex flex-col" dir="rtl">
      <Header />

      <main className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
        {/* Offline Banner */}
        {!isOnline && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-amber-700 text-sm">
            <WifiOff className="h-4 w-4 shrink-0" />
            <span>أنت غير متصل — تعرض المحادثات المحفوظة فقط</span>
          </div>
        )}

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-8">
              {/* Hero */}
              <div className="text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center mx-auto shadow-lg">
                  <Bot className="h-8 w-8 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-foreground">مستشار درب الذكي</h1>
                <p className="text-muted-foreground max-w-md">
                  مرشدك الشخصي للدراسة في ألمانيا 🇩🇪 — اسألني عن القبول، التأشيرة، اللغة، أو الحياة الطلابية
                </p>
              </div>

              {/* Categories */}
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

              {/* Quick questions */}
              <div className="w-full max-w-lg space-y-2">
                <p className="text-sm text-muted-foreground font-medium text-center">ابدأ بسؤال:</p>
                {QUICK_QUESTIONS.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(q)}
                    className="w-full text-right text-sm p-3 rounded-xl border hover:bg-secondary transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Clear history button */}
              <div className="flex justify-center">
                <Button variant="ghost" size="sm" onClick={clearHistory} className="text-muted-foreground text-xs gap-1">
                  <Trash2 className="h-3 w-3" />
                  مسح المحادثة
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

        {/* Input bar */}
        <div className="border-t bg-background p-3 md:p-4 sticky bottom-0">
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
              placeholder="اكتب سؤالك هنا..."
              className="flex-1 text-right"
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
