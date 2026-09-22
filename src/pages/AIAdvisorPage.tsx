import React, { useEffect, useMemo, useRef } from "react";
import Header from "@/components/landing/Header";
import SEOHead from "@/components/common/SEOHead";
import { DARB_CONTACT_ADVISOR_SRC } from "@/assets/darbContactAdvisor";
import { Button } from "@/components/ui/button";
import { useAIChat } from "@/hooks/useAIChat";
import { useTranslation } from "react-i18next";
import { useDirection } from "@/hooks/useDirection";
import {
  ArrowUpRight,
  Bot,
  Mail,
  MessageCircle,
  Trash2,
  FileText,
} from "lucide-react";
import { Link } from "@/lib/router-compat";
import { whatsappBusinessUrl, SUPPORT_EMAIL } from "@/lib/contactConfig";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";

const AIAdvisorPage = () => {
  const { t, i18n } = useTranslation();
  const { dir } = useDirection();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const quickQuestions = t("quickQuestions", { returnObjects: true }) as string[];
  const {
    messages,
    input,
    setInput,
    isLoading,
    isOnline,
    messagesEndRef,
    sendMessage,
    clearHistory,
  } = useAIChat(true);
  const isArabic = i18n.language.startsWith("ar");

  const uiMessages = useMemo(
    () =>
      messages.map((message, index) => ({
        id: `${message.role}-${index}`,
        role: message.role,
        parts: [{ type: "text" as const, text: message.content }],
      })),
    [messages],
  );

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!isLoading) textareaRef.current?.focus();
  }, [isLoading]);

  const whatsappMessage = isArabic
    ? "مرحبا، بدي أتواصل مع فريق درب بخصوص الدراسة بألمانيا."
    : "Hi, I would like to talk to the DARB team about studying in Germany.";

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground" dir={dir}>
      <SEOHead
        title={t("seo.advisorTitle")}
        description={t("seo.advisorDesc")}
        url="/ai-advisor"
      />
      <Header />

      <main className="pb-24 md:pb-0">
        <section className="border-b border-border bg-background">
          <div className="container mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-border bg-editorial-paper p-3 shadow-surface sm:gap-4 sm:p-4">
              <div className="relative size-14 shrink-0 overflow-hidden rounded-full border-2 border-background bg-secondary shadow-surface sm:size-16">
                <img
                  src={DARB_CONTACT_ADVISOR_SRC}
                  alt={t("advisor.imageAlt")}
                  className="absolute inset-0 size-full rounded-full object-cover object-[50%_42%]"
                  fetchPriority="high"
                />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-primary">
                  {t("advisor.hub.eyebrow")}
                </p>
                <h1 className="mt-1 truncate text-lg font-bold leading-tight text-primary sm:text-xl">
                  {t("advisor.hub.title")}
                </h1>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground sm:text-sm sm:leading-6">
                  {t("advisor.hub.intro")}
                </p>
              </div>
            </div>

            <section
              id="ai-advisor-chat"
              aria-label={t("advisor.title")}
              className="flex h-[min(700px,calc(100dvh-7rem))] min-h-[560px] min-w-0 scroll-mt-20 flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-surface sm:rounded-3xl lg:h-[720px]"
            >
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Bot className="size-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold">{t("advisor.title")}</h2>
                    <p className="truncate text-xs text-muted-foreground">{t("advisor.hub.composerHint")}</p>
                  </div>
                </div>
                {messages.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={clearHistory}
                    aria-label={t("chat.clearHistory")}
                    title={t("chat.clearHistory")}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                )}
              </div>

              {!isOnline && (
                <div className="border-b border-border bg-secondary px-4 py-3 text-sm text-secondary-foreground">
                  {t("chat.offlineBanner")}
                </div>
              )}

              <Conversation className="min-h-0 flex-1">
                <ConversationContent className="min-h-full gap-5 p-4 sm:p-6">
                  {uiMessages.length === 0 ? (
                    <ConversationEmptyState className="min-h-full px-1 py-8 sm:px-8">
                      <div className="mx-auto max-w-xl space-y-5 text-center">
                         <div className="mx-auto flex aspect-square size-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-editorial-paper shadow-sm">
                          <img
                            src={DARB_CONTACT_ADVISOR_SRC}
                            alt=""
                             className="size-full rounded-full object-cover object-[50%_42%]"
                          />
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-xl font-semibold text-primary sm:text-2xl">
                            {t("advisor.hub.aiTitle")}
                          </h3>
                          <p className="text-sm leading-6 text-muted-foreground">
                            {t("advisor.hub.aiIntro")}
                          </p>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {quickQuestions.slice(0, 4).map((question) => (
                            <Button
                              key={question}
                              type="button"
                              variant="outline"
                              onClick={() => sendMessage(question)}
                              className="h-auto min-h-11 justify-start whitespace-normal px-4 py-3 text-start text-sm leading-5 hover:border-primary hover:text-primary"
                            >
                              {question}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </ConversationEmptyState>
                  ) : (
                    uiMessages.map((message, index) => {
                      const isUser = message.role === "user";
                      return (
                        <Message
                          key={message.id}
                          from={message.role}
                          className={isUser ? "max-w-[88%] sm:max-w-[78%]" : "max-w-[96%]"}
                        >
                          <MessageContent
                            className={
                              isUser
                                ? "rounded-2xl bg-primary px-4 py-3 text-primary-foreground shadow-sm group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground"
                                : "px-1 py-1 text-foreground"
                            }
                          >
                            {message.parts.map((part, partIndex) =>
                              part.type === "text" ? (
                                isUser ? (
                                  <span key={partIndex} className="whitespace-pre-wrap">{part.text}</span>
                                ) : (
                                  <MessageResponse
                                    key={partIndex}
                                    isAnimating={isLoading && index === uiMessages.length - 1}
                                  >
                                    {part.text}
                                  </MessageResponse>
                                )
                              ) : null,
                            )}
                          </MessageContent>
                        </Message>
                      );
                    })
                  )}

                  {isLoading &&
                    (uiMessages.length === 0 || uiMessages[uiMessages.length - 1]?.role === "user") && (
                      <div className="max-w-[95%]">
                        <Shimmer className="text-sm text-muted-foreground">
                          {t("chat.loading")}
                        </Shimmer>
                      </div>
                    )}
                  <div ref={messagesEndRef} />
                </ConversationContent>
                <ConversationScrollButton aria-label={t("chat.scrollToLatest")} />
              </Conversation>

              <div className="shrink-0 border-t border-border bg-background p-3 sm:p-4">
                <PromptInput
                  onSubmit={({ text }) => sendMessage(text)}
                  className="mx-auto max-w-3xl rounded-2xl border border-border bg-background shadow-sm"
                >
                  <PromptInputTextarea
                    ref={textareaRef}
                    autoFocus
                    placeholder={t("chat.placeholder")}
                    value={input}
                    onChange={(event) => setInput(event.currentTarget.value)}
                    disabled={isLoading}
                    aria-label={t("chat.placeholder")}
                    className="min-h-16 px-4 py-3 text-sm sm:text-base"
                  />
                  <PromptInputFooter className="px-3 pb-2">
                    <span className="min-w-0 truncate text-xs text-muted-foreground">
                      {t("advisor.hub.composerHint")}
                    </span>
                    <PromptInputSubmit
                      aria-label={t("chat.send")}
                      disabled={!input.trim() || isLoading}
                      className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
                      status={isLoading ? "streaming" : "ready"}
                    />
                  </PromptInputFooter>
                </PromptInput>
              </div>
            </section>

            <div className="rounded-2xl border border-border bg-background p-4 shadow-surface sm:p-5">
              <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <MessageCircle className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold">{t("advisor.hub.humanTitle")}</h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {t("advisor.hub.humanCopy")}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Button asChild className="min-h-12 justify-between bg-trust text-primary-foreground hover:bg-trust/90">
                  <a href={whatsappBusinessUrl(whatsappMessage)} target="_blank" rel="noopener noreferrer">
                    <span className="flex items-center gap-2">
                      <MessageCircle className="size-5" aria-hidden="true" />
                      {t("advisor.hub.whatsapp")}
                    </span>
                    <ArrowUpRight className="size-4 opacity-80 rtl:-scale-x-100" aria-hidden="true" />
                  </a>
                </Button>
                <Button asChild variant="outline" className="min-h-12 justify-between">
                  <a href={`mailto:${SUPPORT_EMAIL}`}>
                    <span className="flex min-w-0 items-center gap-2">
                      <Mail className="size-5 shrink-0" aria-hidden="true" />
                      <span className="truncate" dir="ltr">{SUPPORT_EMAIL}</span>
                    </span>
                    <ArrowUpRight className="size-4 shrink-0 opacity-70 rtl:-scale-x-100" aria-hidden="true" />
                  </a>
                </Button>
              </div>
              <Button asChild variant="ghost" className="mt-3 w-full justify-between">
                <Link to="/contact">
                  <span className="flex items-center gap-2"><FileText className="size-4" />{t("advisor.hub.contactForm")}</span>
                  <ArrowUpRight className="size-4 opacity-70 rtl:-scale-x-100" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default AIAdvisorPage;
