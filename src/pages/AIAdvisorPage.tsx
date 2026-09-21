import React from "react";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import SEOHead from "@/components/common/SEOHead";
import darbLogoAsset from "@/assets/darb-logo.png.asset.json";
import { Button } from "@/components/ui/button";
import { useAIChat } from "@/hooks/useAIChat";
import { useTranslation } from "react-i18next";
import { useDirection } from "@/hooks/useDirection";
import { Mail, MessageCircle, Sparkles, Trash2, Bot, ArrowUpRight } from "lucide-react";
import { whatsappBusinessUrl, SUPPORT_EMAIL } from "@/lib/contactConfig";
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea } from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";

const AIAdvisorPage = () => {
  const { t, i18n } = useTranslation();
  const { dir } = useDirection();
  const quickQuestions = t("quickQuestions", { returnObjects: true }) as string[];
  const { messages, input, setInput, isLoading, isOnline, inputRef, messagesEndRef, sendMessage, clearHistory } = useAIChat(true);
  const isArabic = i18n.language === "ar";

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground" dir={dir}>
      <SEOHead title={t("seo.advisorTitle")} description={t("seo.advisorDesc")} url="/ai-advisor" />
      <Header />
      <main className="pb-24 md:pb-0">
        <section className="border-b border-border bg-background">
          <div className="container mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-14">
            <div className="grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)] lg:items-start">
              <div className="space-y-6">
                <div className="flex items-center justify-between gap-4">
                  <img src={darbLogoAsset.url} alt={t("loader.brand", "Darb")} width={182} height={64} className="h-auto w-32 object-contain sm:w-40" />
                  <span className="hidden h-1.5 w-24 rounded-full bg-[linear-gradient(90deg,#082B66_0_14%,#0B78FF_14%_28%,#00AFC7_28%_42%,#22CC5E_42%_56%,#FFC107_56%_70%,#FF8A00_70%_84%,#F53838_84%_100%)] sm:block" aria-hidden="true" />
                </div>
                <div className="relative overflow-hidden rounded-3xl border border-border bg-secondary/40 p-5 shadow-surface sm:p-7">
                  <div className="absolute -bottom-14 -end-10 h-32 w-52 rounded-[50%] border-[16px] border-[#082B66] opacity-10 sm:h-44 sm:w-72" aria-hidden="true" />
                  <div className="relative flex items-start gap-4">
                    <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-background bg-primary/10 shadow-sm">
                      <img src={darbLogoAsset.url} alt={t("advisor.imageAlt", "DARB study advisor")} className="h-full w-full object-contain p-1.5" />
                    </div>
                    <div className="min-w-0 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{t("advisor.hub.eyebrow")}</p>
                      <h1 className="text-2xl font-bold leading-tight text-primary sm:text-4xl">{t("advisor.hub.title")}</h1>
                      <p className="text-sm leading-6 text-muted-foreground sm:text-base">{t("advisor.hub.intro")}</p>
                    </div>
                  </div>
                  <div className="mt-6 rounded-2xl bg-background p-4 ring-1 ring-border/70">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><MessageCircle className="size-4" aria-hidden="true" /></span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{t("advisor.hub.humanTitle")}</p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">{t("advisor.hub.humanCopy")}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <a href={whatsappBusinessUrl(isArabic ? "مرحبا، بدي أتواصل مع فريق درب بخصوص الدراسة بألمانيا." : "Hi, I would like to talk to the DARB team about studying in Germany.")} target="_blank" rel="noopener noreferrer" className="group flex min-h-12 items-center justify-between gap-3 rounded-2xl bg-[#22CC5E] px-4 py-3 text-sm font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transform-none">
                    <span className="flex items-center gap-3"><MessageCircle className="size-5" aria-hidden="true" />{t("advisor.hub.whatsapp")}</span><ArrowUpRight className="size-4 opacity-80" aria-hidden="true" />
                  </a>
                  <a href={`mailto:${SUPPORT_EMAIL}`} className="group flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold text-primary shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transform-none" dir="ltr">
                    <span className="flex items-center gap-3"><Mail className="size-5" aria-hidden="true" />{SUPPORT_EMAIL}</span><ArrowUpRight className="size-4 opacity-70" aria-hidden="true" />
                  </a>
                  <a href="#ai-advisor-chat" className="group flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transform-none">
                    <span className="flex items-center gap-3"><Sparkles className="size-5" aria-hidden="true" />{t("advisor.hub.askAi")}</span><ArrowUpRight className="size-4 opacity-80" aria-hidden="true" />
                  </a>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-background p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t("advisor.hub.humanLabel")}</p><p className="mt-2 text-sm leading-6 text-foreground">{t("advisor.hub.humanSupport")}</p></div>
                  <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{t("advisor.hub.aiLabel")}</p><p className="mt-2 text-sm leading-6 text-foreground">{t("advisor.hub.aiSupport")}</p></div>
                </div>
              </div>
              <section id="ai-advisor-chat" aria-label={t("advisor.title")} className="flex min-h-[620px] flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-surface lg:min-h-[720px]">
                <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3 sm:px-5">
                  <div className="flex items-center gap-3"><div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary"><Bot className="size-4" aria-hidden="true" /></div><div><p className="text-sm font-semibold">{t("advisor.title")}</p><p className="text-xs text-muted-foreground">{t("advisor.description")}</p></div></div>
                  {messages.length > 0 && <Button type="button" variant="ghost" size="sm" onClick={clearHistory} className="min-h-10 gap-2 text-xs text-muted-foreground"><Trash2 className="size-3.5" aria-hidden="true" />{t("chat.clearHistory")}</Button>}
                </div>
                {!isOnline && <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{t("chat.offlineBanner")}</div>}
                <Conversation className="min-h-0 flex-1">
                  <ConversationContent className="min-h-full gap-5 p-4 sm:p-6">
                    {messages.length === 0 ? <ConversationEmptyState className="min-h-full py-10"><div className="mx-auto max-w-xl space-y-6 text-center"><div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm"><Sparkles className="size-6" aria-hidden="true" /></div><div className="space-y-2"><h2 className="text-xl font-semibold text-primary sm:text-2xl">{t("advisor.hub.aiTitle")}</h2><p className="text-sm leading-6 text-muted-foreground">{t("advisor.hub.aiIntro")}</p></div><div className="flex flex-wrap justify-center gap-2">{quickQuestions.slice(0, 4).map((question) => <Button key={question} type="button" variant="outline" size="sm" onClick={() => sendMessage(question)} className="min-h-11 rounded-full border-border px-4 text-start text-sm hover:border-primary hover:text-primary">{question}</Button>)}</div></div></ConversationEmptyState> : messages.map((message, index) => { const isUser = message.role === "user"; return <Message key={index} from={message.role} className={isUser ? "max-w-[90%] sm:max-w-[78%]" : "max-w-[95%]"}><MessageContent className={isUser ? "rounded-2xl bg-primary px-4 py-3 text-primary-foreground shadow-sm group-[.is-user]:text-primary-foreground" : "px-1 py-1 text-foreground"}>{isUser ? message.content : <MessageResponse isAnimating={isLoading && index === messages.length - 1}>{message.content}</MessageResponse>}</MessageContent></Message>; })}
                    {isLoading && (messages.length === 0 || messages[messages.length - 1]?.role === "user") && <div className="max-w-[95%]"><Shimmer className="text-sm text-muted-foreground">{t("chat.loading", "Thinking…")}</Shimmer></div>}
                    <div ref={messagesEndRef} />
                  </ConversationContent>
                  <ConversationScrollButton aria-label={t("chat.scrollToLatest", "Scroll to latest")} />
                </Conversation>
                <div className="border-t border-border bg-background p-3 sm:p-4">
                  <PromptInput onSubmit={({ text }) => sendMessage(text)} className="mx-auto max-w-3xl rounded-2xl border border-border bg-background shadow-sm">
                    <PromptInputTextarea ref={inputRef} placeholder={t("chat.placeholder")} value={input} onChange={(event) => setInput(event.currentTarget.value)} disabled={isLoading} aria-label={t("chat.placeholder")} className="min-h-16 px-4 py-3 text-sm sm:text-base" />
                    <PromptInputFooter className="px-3 pb-2"><span className="text-[11px] text-muted-foreground">{t("advisor.hub.composerHint")}</span><PromptInputSubmit aria-label={t("chat.send", "Send")} disabled={!input.trim() || isLoading} className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90" status={isLoading ? "streaming" : undefined} /></PromptInputFooter>
                  </PromptInput>
                </div>
              </section>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default AIAdvisorPage;